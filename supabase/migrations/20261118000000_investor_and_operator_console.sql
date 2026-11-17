-- PRD v1.6 (IV-1 to IV-5, PR-4, SEC-2, DI-2): investor verification, private evidence storage
-- and the operator review console. Apply after 20261117000000_verification_architecture.sql.

-- 1. Operator helper --------------------------------------------------------------------------

-- SECURITY DEFINER so policies on other tables can check the caller's role without tripping
-- over the row-level security on `profiles` itself.
create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'operator'
  );
$$;

revoke all on function public.is_operator() from public, anon;
grant execute on function public.is_operator() to authenticated;

-- 2. Grant the operator role ------------------------------------------------------------------

-- Works whether or not this account already has a profile row. If the account has never
-- signed in there is no auth user yet, nothing happens, and this statement must be re-run.
insert into public.profiles (id, email, role)
select id, email, 'operator' from auth.users where lower(email) = 'beatscy1926@gmail.com'
on conflict (id) do update set role = 'operator';

-- 3. investor_profiles ------------------------------------------------------------------------

create table if not exists public.investor_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  investor_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.investor_profiles
  add column if not exists funds_student_companies boolean not null default false,
  add column if not exists firm text,
  add column if not exists title text,
  add column if not exists evidence_type text,
  add column if not exists evidence_file_path text,
  add column if not exists evidence jsonb not null default '{}'::jsonb,
  add column if not exists verification_status text not null default 'draft',
  add column if not exists reviewer_notes text,
  add column if not exists submitted_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists reviewer_id uuid references auth.users (id) on delete set null;

-- Move the table from the previous migration's values to the PRD v1.6 ones.
alter table public.investor_profiles drop constraint if exists investor_profiles_investor_type_check;
alter table public.investor_profiles drop constraint if exists investor_profiles_verification_status_check;

update public.investor_profiles set investor_type = case investor_type
  when 'individual_angel' then 'angel'
  when 'vc_professional' then 'vc'
  when 'general_investor' then 'general'
  else investor_type end;
update public.investor_profiles set verification_status = 'verified' where verification_status = 'approved';

alter table public.investor_profiles alter column verification_status set default 'draft';
alter table public.investor_profiles
  add constraint investor_profiles_investor_type_check check (investor_type in ('angel', 'vc', 'general', 'student_fund')),
  add constraint investor_profiles_verification_status_check check (verification_status in ('draft', 'pending_review', 'verified', 'rejected'));

alter table public.investor_profiles drop column if exists reviewed_at;

alter table public.cofounder_profiles add column if not exists reviewer_notes text;

-- 4. operator_audit_logs ----------------------------------------------------------------------

create table if not exists public.operator_audit_logs (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references auth.users (id),
  target_user_id uuid not null references auth.users (id),
  action text not null check (action in ('approve', 'reject', 'request_changes')),
  target_type text not null check (target_type in ('founder', 'investor')),
  reason_code text,
  created_at timestamptz not null default now()
);

create index if not exists operator_audit_logs_target_idx on public.operator_audit_logs (target_user_id, created_at desc);

-- 5. Row-level security -----------------------------------------------------------------------

alter table public.investor_profiles enable row level security;
alter table public.operator_audit_logs enable row level security;

-- Investors: their own row only (policies from the previous migration are re-created here).
drop policy if exists "Users read own investor profile" on public.investor_profiles;
create policy "Users read own investor profile" on public.investor_profiles
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users create own investor profile" on public.investor_profiles;
create policy "Users create own investor profile" on public.investor_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own investor profile" on public.investor_profiles;
create policy "Users update own investor profile" on public.investor_profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Operators: full read/write on both review queues.
drop policy if exists "Operators manage investor profiles" on public.investor_profiles;
create policy "Operators manage investor profiles" on public.investor_profiles
  for all to authenticated using ((select public.is_operator())) with check ((select public.is_operator()));

drop policy if exists "Operators manage cofounder profiles" on public.cofounder_profiles;
create policy "Operators manage cofounder profiles" on public.cofounder_profiles
  for all to authenticated using ((select public.is_operator())) with check ((select public.is_operator()));

-- Operators need names and emails for the review cards. Read only: they cannot edit accounts.
drop policy if exists "Operators read profiles" on public.profiles;
create policy "Operators read profiles" on public.profiles
  for select to authenticated using ((select public.is_operator()));

-- The audit log is append-only: operators can read it and add their own entries, and nobody
-- can edit or delete an entry through the API.
drop policy if exists "Operators read audit logs" on public.operator_audit_logs;
create policy "Operators read audit logs" on public.operator_audit_logs
  for select to authenticated using ((select public.is_operator()));

drop policy if exists "Operators write audit logs" on public.operator_audit_logs;
create policy "Operators write audit logs" on public.operator_audit_logs
  for insert to authenticated with check ((select public.is_operator()) and operator_id = (select auth.uid()));

revoke update, delete, truncate on public.operator_audit_logs from anon, authenticated;

-- 6. Review guards ----------------------------------------------------------------------------

-- Same guard as the previous migration, now letting operators through. Other signed-in users
-- may only set the statuses listed on each trigger, or leave the status unchanged.
create or replace function public.guard_review_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  status_column text := tg_argv[0];
  new_status text := to_jsonb(new) ->> status_column;
  old_status text := case when tg_op = 'UPDATE' then to_jsonb(old) ->> status_column end;
begin
  if (select auth.role()) is distinct from 'authenticated' or public.is_operator() then
    return new;
  end if;
  if new_status is not distinct from old_status or new_status = any (tg_argv[1:]) then
    return new;
  end if;
  raise exception 'Only an operator can set % to "%".', status_column, new_status using errcode = '42501';
end;
$$;

-- Investors additionally cannot touch the reviewer's fields, and cannot change a submission
-- once it has been verified (the verified record must stay what the operator approved).
create or replace function public.guard_investor_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) is distinct from 'authenticated' or public.is_operator() then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.verification_status = 'verified' then
    raise exception 'A verified investor profile can only be changed by an operator.' using errcode = '42501';
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

drop trigger if exists investor_profiles_guard_status on public.investor_profiles;
drop trigger if exists investor_profiles_guard on public.investor_profiles;
create trigger investor_profiles_guard before insert or update on public.investor_profiles
  for each row execute function public.guard_investor_profile();

drop trigger if exists investor_profiles_set_updated_at on public.investor_profiles;
create trigger investor_profiles_set_updated_at before update on public.investor_profiles
  for each row execute function public.set_updated_at();

-- 7. Private evidence storage (SEC-2) ---------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-evidence', 'verification-evidence', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Users upload into a folder named after their own user id, and can read back only that folder.
-- There is deliberately no update or delete policy: evidence cannot be swapped or removed
-- after upload, so what an operator reviewed is what stays on file.
drop policy if exists "Users upload own verification evidence" on storage.objects;
create policy "Users upload own verification evidence" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'verification-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users read own verification evidence" on storage.objects;
create policy "Users read own verification evidence" on storage.objects
  for select to authenticated
  using (bucket_id = 'verification-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Operators read verification evidence" on storage.objects;
create policy "Operators read verification evidence" on storage.objects
  for select to authenticated
  using (bucket_id = 'verification-evidence' and (select public.is_operator()));
