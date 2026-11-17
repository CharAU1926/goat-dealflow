-- PRD v1.6: onboarding, founder review and investor verification.
-- Aligns the app with the tables that already existed in this project (profiles,
-- cofounder_profiles) and corrects two side effects of the previous migration.

-- 1. profiles ---------------------------------------------------------------------------------

-- A new account must have no role until the user picks one (AU-4).
alter table public.profiles alter column role drop default;

-- The previous migration's check blocked the 'operator' value of the user_role enum outright.
-- It is replaced by a trigger that only stops users from granting it to themselves.
alter table public.profiles drop constraint if exists profiles_role_check;

-- 2. cofounder_profiles -----------------------------------------------------------------------

-- updated_at was missing although the previous migration attached an updated_at trigger,
-- which made every UPDATE on this table fail.
alter table public.cofounder_profiles
  add column if not exists linkedin_url text,
  add column if not exists github_url text,
  add column if not exists portfolio_url text,
  add column if not exists company_type public.company_type,
  add column if not exists submitted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- 3. investor_profiles (IV-1) -----------------------------------------------------------------

create table if not exists public.investor_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  investor_type text not null check (investor_type in ('individual_angel', 'vc_professional', 'general_investor', 'student_fund')),
  evidence jsonb not null default '{}'::jsonb,
  verification_status text not null default 'pending_review' check (verification_status in ('pending_review', 'approved', 'rejected')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.investor_profiles enable row level security;

drop policy if exists "Users read own investor profile" on public.investor_profiles;
create policy "Users read own investor profile" on public.investor_profiles
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users create own investor profile" on public.investor_profiles;
create policy "Users create own investor profile" on public.investor_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own investor profile" on public.investor_profiles;
create policy "Users update own investor profile" on public.investor_profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop trigger if exists investor_profiles_set_updated_at on public.investor_profiles;
create trigger investor_profiles_set_updated_at before update on public.investor_profiles
  for each row execute function public.set_updated_at();

-- 4. Operator-only outcomes (CF-9, IV-2) ------------------------------------------------------

-- Users can write their own rows, so without these guards anyone could approve themselves
-- through the API. Signed-in users may only set the listed statuses (or leave the status
-- unchanged). Operators act through the service role or the SQL editor, which are not affected.
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
  if (select auth.role()) is distinct from 'authenticated' then
    return new;
  end if;
  if new_status is not distinct from old_status or new_status = any (tg_argv[1:]) then
    return new;
  end if;
  raise exception 'Only an operator can set % to "%".', status_column, new_status using errcode = '42501';
end;
$$;

drop trigger if exists cofounder_profiles_guard_status on public.cofounder_profiles;
create trigger cofounder_profiles_guard_status before insert or update on public.cofounder_profiles
  for each row execute function public.guard_review_status('visibility_status', 'draft', 'pending_review', 'paused');

drop trigger if exists investor_profiles_guard_status on public.investor_profiles;
create trigger investor_profiles_guard_status before insert or update on public.investor_profiles
  for each row execute function public.guard_review_status('verification_status', 'pending_review');

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before insert or update on public.profiles
  for each row execute function public.guard_review_status('role', 'founder', 'investor');
