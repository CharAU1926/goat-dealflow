-- PRD v1.6: database-driven deal deck (DK-2, DK-3), saved deals (AU-3), startup verification
-- (CS-1) and evidence retention tracking (IV-4).
-- Apply after 20261118000000_investor_and_operator_console.sql.

-- 1. Startup verification fields ---------------------------------------------------------------

alter table public.startups
  add column if not exists traction_signal text,
  add column if not exists legal_name text,
  add column if not exists registration_number text,
  add column if not exists registration_country text,
  add column if not exists evidence_type text,
  add column if not exists evidence_file_path text,
  add column if not exists safe_claims_declared_at timestamptz,
  add column if not exists active_raise_confirmed_at timestamptz,
  add column if not exists verification_status text not null default 'draft',
  add column if not exists reviewer_notes text,
  add column if not exists reviewer_id uuid references auth.users (id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.startups drop constraint if exists startups_verification_status_check;
alter table public.startups add constraint startups_verification_status_check
  check (verification_status in ('draft', 'pending_review', 'verified', 'rejected'));

drop trigger if exists startups_set_updated_at on public.startups;
create trigger startups_set_updated_at before update on public.startups
  for each row execute function public.set_updated_at();

-- Owners can already write their own startup row, which would let them verify themselves.
-- Signed-in non-operators can only move between draft and pending_review, can never touch the
-- operator-owned fields, and cannot edit a startup once it has been verified.
create or replace function public.guard_startup()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) is distinct from 'authenticated' or public.is_operator() then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.verification_status = 'verified' then
    raise exception 'A verified startup can only be changed by an operator.' using errcode = '42501';
  end if;
  if new.verification_status not in ('draft', 'pending_review') then
    raise exception 'Only an operator can set verification_status to "%".', new.verification_status using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    new.owner_user_id := old.owner_user_id;
    new.funding_scope := old.funding_scope;
    new.verified_at := old.verified_at;
    new.readiness_score := old.readiness_score;
    new.reviewer_notes := old.reviewer_notes;
    new.reviewer_id := old.reviewer_id;
  else
    new.funding_scope := 'pending_review';
    new.verified_at := null;
    new.readiness_score := 0;
    new.reviewer_notes := null;
    new.reviewer_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists startups_guard on public.startups;
create trigger startups_guard before insert or update on public.startups
  for each row execute function public.guard_startup();

drop policy if exists "Operators manage startups" on public.startups;
create policy "Operators manage startups" on public.startups
  for all to authenticated using ((select public.is_operator())) with check ((select public.is_operator()));

-- The audit log now also records startup reviews.
alter table public.operator_audit_logs drop constraint if exists operator_audit_logs_target_type_check;
alter table public.operator_audit_logs add constraint operator_audit_logs_target_type_check
  check (target_type in ('founder', 'investor', 'startup'));

-- 2. Tier 0 deck view (DK-2) -------------------------------------------------------------------

-- The only way anonymous visitors and unverified investors can read startups. It exposes the
-- Tier 0 columns and nothing else, so contact emails, descriptions, registration details and
-- evidence cannot leak however the app queries it. It runs with its owner's rights on purpose
-- (security_invoker = false): the underlying table stays closed to everyone but owners and operators.
create or replace view public.startup_teasers
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
  readiness_score,
  verified_at
from public.startups
where verified_at is not null
  and verification_status = 'verified'
  and funding_scope in ('student_funds_only', 'all_investors');

revoke all on public.startup_teasers from public, anon, authenticated;
grant select on public.startup_teasers to anon, authenticated;

-- 3. saved_deals (AU-3) ------------------------------------------------------------------------

create table if not exists public.saved_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  startup_id uuid not null references public.startups (id) on delete cascade,
  campaign text,
  created_at timestamptz not null default now(),
  unique (user_id, startup_id)
);

alter table public.saved_deals enable row level security;

drop policy if exists "Users read own saved deals" on public.saved_deals;
create policy "Users read own saved deals" on public.saved_deals
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users save deals" on public.saved_deals;
create policy "Users save deals" on public.saved_deals
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users remove own saved deals" on public.saved_deals;
create policy "Users remove own saved deals" on public.saved_deals
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 4. Evidence retention tracking (IV-4) --------------------------------------------------------

-- One row per file uploaded to the private 'verification-evidence' bucket, recording when it is
-- due to be purged. This migration only records the dates: a scheduled job that deletes files
-- past `purge_after` and stamps `purged_at` still has to be set up.
create table if not exists public.evidence_files (
  file_path text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('investor', 'startup')),
  uploaded_at timestamptz not null default now(),
  purge_after timestamptz not null default (now() + interval '90 days'),
  purged_at timestamptz
);

create index if not exists evidence_files_purge_idx on public.evidence_files (purge_after) where purged_at is null;

alter table public.evidence_files enable row level security;

-- Users can register their own uploads but cannot push the purge date out or mark a file purged.
drop policy if exists "Users register own evidence files" on public.evidence_files;
create policy "Users register own evidence files" on public.evidence_files
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and file_path like (select auth.uid())::text || '/%'
    and purge_after <= now() + interval '90 days'
    and purged_at is null
  );

drop policy if exists "Users read own evidence files" on public.evidence_files;
create policy "Users read own evidence files" on public.evidence_files
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Operators manage evidence files" on public.evidence_files;
create policy "Operators manage evidence files" on public.evidence_files
  for all to authenticated using ((select public.is_operator())) with check ((select public.is_operator()));
