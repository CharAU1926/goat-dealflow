-- Waitlist management (PRD v1.6 WL-2, WL-3): operator console + closed-beta gate.
-- Apply after 20261120000001_deck_funding_scope.sql (needs public.is_operator()).

-- 1. Columns -----------------------------------------------------------------------------------
-- The table was created by hand, so create it if missing and top up any missing column.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('founder', 'investor')),
  source text default 'direct',
  campaign text default 'organic',
  consent_version text default 'v1.0',
  status text default 'pending' check (status in ('pending', 'verified', 'invited')),
  created_at timestamptz default now()
);

alter table public.waitlist add column if not exists invited_at timestamptz;

create index if not exists waitlist_status_created_idx on public.waitlist (status, created_at desc);

-- 2. Row-level security ------------------------------------------------------------------------
alter table public.waitlist enable row level security;

-- Table grants were wide open (anon could read and delete). RLS now decides, but narrow the
-- grants as well so a dropped policy can never expose the list.
revoke all on public.waitlist from anon, authenticated;
grant insert on public.waitlist to anon, authenticated;
grant select, update on public.waitlist to authenticated;

-- Operators: view and update (invite). Export is a read, so the select policy covers it.
drop policy if exists "Operators read waitlist" on public.waitlist;
create policy "Operators read waitlist" on public.waitlist
  for select to authenticated using ((select public.is_operator()));

drop policy if exists "Operators update waitlist" on public.waitlist;
create policy "Operators update waitlist" on public.waitlist
  for update to authenticated using ((select public.is_operator())) with check ((select public.is_operator()));

-- The public landing-page form may add a row, but only as a fresh 'pending' entry.
drop policy if exists "Public can join waitlist" on public.waitlist;
create policy "Public can join waitlist" on public.waitlist
  for insert to anon, authenticated
  with check (status = 'pending' and invited_at is null);

-- 3. Closed-beta gate --------------------------------------------------------------------------
-- WL-3: may this email sign in? Yes when it was invited from the waitlist, or it already belongs
-- to an account (operators and founders approved before the beta). Returns only a boolean, so the
-- waitlist itself is never readable by visitors.
create or replace function public.can_access_beta(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.waitlist where lower(email) = lower(p_email) and status = 'invited')
      or exists (select 1 from public.profiles where lower(email) = lower(p_email));
$$;

revoke all on function public.can_access_beta(text) from public;
grant execute on function public.can_access_beta(text) to anon, authenticated;
