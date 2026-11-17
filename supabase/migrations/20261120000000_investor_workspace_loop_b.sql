-- PRD v1.6 Loop B: investor mandate (CS-5), saved-deals pipeline (SD-1 to SD-4), information
-- tiers (DK-9) and the secure contact engine (CS-4, IN-1, DI-2).
-- Apply after 20261119000001_cofounder_loop_a.sql.

-- 1. Helper: verified investor ----------------------------------------------------------------

-- SECURITY DEFINER so it can be used inside other functions and policies without tripping
-- over row-level security on `profiles` / `investor_profiles`.
create or replace function public.is_verified_investor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.investor_profiles ip
    join public.profiles p on p.id = ip.user_id
    where ip.user_id = (select auth.uid())
      and ip.verification_status = 'verified'
      and p.role = 'investor'
  );
$$;

revoke all on function public.is_verified_investor() from public, anon;
grant execute on function public.is_verified_investor() to authenticated;

-- 2. Investor mandate (CS-5) ------------------------------------------------------------------

-- Investors can now save a mandate before they submit verification, so the investor type is
-- optional until they do.
alter table public.investor_profiles alter column investor_type drop not null;

alter table public.investor_profiles
  add column if not exists mandate_sectors text[] not null default '{}',
  add column if not exists mandate_stages text[] not null default '{}',
  add column if not exists mandate_geographies text[] not null default '{}',
  add column if not exists cheque_min bigint,
  add column if not exists cheque_max bigint,
  -- null = never chosen; the app then defaults to registered-only unless funds_student_companies.
  add column if not exists mandate_company_type text,
  add column if not exists mandate_updated_at timestamptz;

alter table public.investor_profiles drop constraint if exists investor_profiles_mandate_check;
alter table public.investor_profiles add constraint investor_profiles_mandate_check check (
  mandate_sectors <@ array['SaaS', 'FinTech', 'DeepTech', 'AI', 'Health', 'Maritime', 'Other']
  and mandate_stages <@ array['pre_seed', 'seed', 'series_a']
  and mandate_geographies <@ array['cyprus', 'greece', 'pan_european']
  and (cheque_min is null or cheque_min >= 0)
  and (cheque_max is null or cheque_max >= 0)
  and (cheque_min is null or cheque_max is null or cheque_min <= cheque_max)
  and (mandate_company_type is null or mandate_company_type in ('registered_only', 'include_student'))
);

-- Verified profiles are frozen for investors, except for the mandate, which stays editable.
create or replace function public.guard_investor_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  mandate_keys constant text[] := array[
    'mandate_sectors', 'mandate_stages', 'mandate_geographies', 'cheque_min', 'cheque_max',
    'mandate_company_type', 'mandate_updated_at', 'updated_at'
  ];
begin
  if (select auth.role()) is distinct from 'authenticated' or public.is_operator() then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.verification_status = 'verified' then
    if (to_jsonb(new) - mandate_keys) is distinct from (to_jsonb(old) - mandate_keys) then
      raise exception 'A verified investor profile can only be changed by an operator.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.verification_status not in ('draft', 'pending_review') then
    raise exception 'Only an operator can set verification_status to "%".', new.verification_status using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    new.reviewer_notes := old.reviewer_notes;
    new.reviewer_id := old.reviewer_id;
    new.verified_at := old.verified_at;
  else
    new.reviewer_notes := null;
    new.reviewer_id := null;
    new.verified_at := null;
  end if;
  return new;
end;
$$;

-- 3. Saved-deals pipeline (SD-1, SD-2, SD-4) --------------------------------------------------

alter table public.saved_deals
  add column if not exists pipeline_status text not null default 'saved',
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.saved_deals drop constraint if exists saved_deals_pipeline_status_check;
alter table public.saved_deals add constraint saved_deals_pipeline_status_check
  check (pipeline_status in ('saved', 'reviewing', 'contacted', 'passed', 'invested'));

alter table public.saved_deals drop constraint if exists saved_deals_notes_check;
alter table public.saved_deals add constraint saved_deals_notes_check check (notes is null or char_length(notes) <= 4000);

-- Notes are private (SD-2): the only policies on this table are the owner's.
drop policy if exists "Users update own saved deals" on public.saved_deals;
create policy "Users update own saved deals" on public.saved_deals
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Only the pipeline columns can change; a saved deal can never be re-pointed at another user or startup.
create or replace function public.guard_saved_deal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := old.user_id;
  new.startup_id := old.startup_id;
  new.campaign := old.campaign;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists saved_deals_guard on public.saved_deals;
create trigger saved_deals_guard before update on public.saved_deals
  for each row execute function public.guard_saved_deal();

drop trigger if exists saved_deals_set_updated_at on public.saved_deals;
create trigger saved_deals_set_updated_at before update on public.saved_deals
  for each row execute function public.set_updated_at();

-- 4. Information tiers (DK-9) -----------------------------------------------------------------

alter table public.startups
  add column if not exists description text,
  add column if not exists team_bios jsonb not null default '[]'::jsonb,        -- [{ "name", "role", "bio" }]
  add column if not exists use_of_funds text,
  add column if not exists website text,
  -- Tier 2 (verified investors only) --
  add column if not exists contact_email text,
  add column if not exists pitch_deck_url text,
  add column if not exists confidential_metrics jsonb not null default '[]'::jsonb; -- [{ "label", "value" }]

alter table public.startups drop constraint if exists startups_tier_fields_check;
alter table public.startups add constraint startups_tier_fields_check check (
  (website is null or website ~* '^https?://')
  and (pitch_deck_url is null or pitch_deck_url ~* '^https?://')
  and (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  and jsonb_typeof(team_bios) = 'array'
  and jsonb_typeof(confidential_metrics) = 'array'
);

-- Tier 1: any signed-in user. Same live-deal rule as `startup_teasers`, plus the open profile.
-- Contact email, pitch deck and metrics are NOT in this view.
create or replace view public.startup_profiles
with (security_invoker = false)
as
select
  id,
  name,
  one_liner,
  sectors,
  stage,
  location,
  funding_sought,
  traction_signal,
  description,
  team_bios,
  use_of_funds,
  website
from public.startups
where verified_at is not null
  and verification_status = 'verified'
  and funding_scope in ('student_funds_only', 'all_investors');

revoke all on public.startup_profiles from public, anon, authenticated;
grant select on public.startup_profiles to authenticated;

-- Tier 2: confidential pitch deck and metrics. Returns no rows for anyone but a verified
-- investor, so the data cannot be fetched by calling the API directly. The contact email is
-- deliberately not returned here; it is only released by `log_investor_contact`.
create or replace function public.get_startup_confidential(p_startup_id uuid)
returns table (pitch_deck_url text, confidential_metrics jsonb, has_contact boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.pitch_deck_url, s.confidential_metrics, s.contact_email is not null
  from public.startups s
  where s.id = p_startup_id
    and public.is_verified_investor()
    and s.verified_at is not null
    and s.verification_status = 'verified'
    and s.funding_scope in ('student_funds_only', 'all_investors');
$$;

revoke all on function public.get_startup_confidential(uuid) from public, anon;
grant execute on function public.get_startup_confidential(uuid) to authenticated;

-- 5. Contact engine (CS-4, IN-1, DI-2) --------------------------------------------------------

create table if not exists public.investor_contacts (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references auth.users (id) on delete cascade,
  startup_id uuid not null references public.startups (id) on delete cascade,
  clicked_at timestamptz not null default now(),
  -- true when this click created a founder notification; false when it was a repeat inside 24h.
  founder_notified boolean not null default false
);

create index if not exists investor_contacts_lookup_idx on public.investor_contacts (investor_id, startup_id, clicked_at desc);

create table if not exists public.founder_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,        -- the founder being notified
  type text not null check (type in ('investor_contact')),
  startup_id uuid not null references public.startups (id) on delete cascade,
  investor_id uuid references auth.users (id) on delete set null,
  contact_id uuid references public.investor_contacts (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists founder_notifications_user_idx on public.founder_notifications (user_id, created_at desc);

alter table public.investor_contacts enable row level security;
alter table public.founder_notifications enable row level security;

-- Rows are written only by `log_investor_contact`; there are deliberately no insert, update or
-- delete policies for end users.
drop policy if exists "Investors read own contacts" on public.investor_contacts;
create policy "Investors read own contacts" on public.investor_contacts
  for select to authenticated using ((select auth.uid()) = investor_id);

drop policy if exists "Operators read investor contacts" on public.investor_contacts;
create policy "Operators read investor contacts" on public.investor_contacts
  for select to authenticated using ((select public.is_operator()));

drop policy if exists "Founders read own notifications" on public.founder_notifications;
create policy "Founders read own notifications" on public.founder_notifications
  for select to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete, truncate on public.investor_contacts from anon, authenticated;
revoke insert, update, delete, truncate on public.founder_notifications from anon, authenticated;

-- Logs a "Contact Company" click and releases the contact email, atomically.
--  * Only verified investors can call it, and only for live deals.
--  * Every click is logged (clicked_at = now()).
--  * DI-2: the founder is notified once per investor + company per 24 hours. A repeat click
--    inside that window is logged with founder_notified = false and creates no notification.
create or replace function public.log_investor_contact(p_startup_id uuid)
returns table (out_email text, out_startup_name text, out_notified boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_startup record;
  v_recent boolean;
  v_contact_id uuid;
begin
  if v_uid is null or not public.is_verified_investor() then
    raise exception 'Only verified investors can contact companies.' using errcode = '42501';
  end if;

  select s.name, s.owner_user_id, s.contact_email
    into v_startup
  from public.startups s
  where s.id = p_startup_id
    and s.verified_at is not null
    and s.verification_status = 'verified'
    and s.funding_scope in ('student_funds_only', 'all_investors');

  if not found then
    raise exception 'This company is no longer available.' using errcode = 'P0002';
  end if;
  if v_startup.contact_email is null then
    raise exception 'This company has not provided a contact email yet.' using errcode = 'P0002';
  end if;

  -- Serialise concurrent clicks from the same investor on the same company.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_startup_id::text, 0));

  select exists (
    select 1 from public.investor_contacts c
    where c.investor_id = v_uid
      and c.startup_id = p_startup_id
      and c.founder_notified
      and c.clicked_at > now() - interval '24 hours'
  ) into v_recent;

  insert into public.investor_contacts (investor_id, startup_id, clicked_at, founder_notified)
  values (v_uid, p_startup_id, now(), not v_recent)
  returning id into v_contact_id;

  if not v_recent then
    insert into public.founder_notifications (user_id, type, startup_id, investor_id, contact_id)
    values (v_startup.owner_user_id, 'investor_contact', p_startup_id, v_uid, v_contact_id);
  end if;

  return query select v_startup.contact_email, v_startup.name, not v_recent;
end;
$$;

revoke all on function public.log_investor_contact(uuid) from public, anon;
grant execute on function public.log_investor_contact(uuid) to authenticated;
