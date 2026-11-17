-- Task 2: account profiles (role, age gate, marketing consent) and founder / co-founder profiles.
-- Written additively so it is safe to run against a database where these tables already exist.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists role text,
  add column if not exists age_confirmed_at timestamptz,
  add column if not exists consent_version text,
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists marketing_opt_in_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role is null or role in ('founder', 'investor'));

create table if not exists public.cofounder_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  headline text,
  bio text,
  location text default 'Cyprus',
  languages text[] not null default array['English', 'Greek'],
  skills text[] not null default '{}',
  roles_sought text[] not null default '{}',
  commitment text check (commitment is null or commitment in ('full_time', 'part_time')),
  equity_min numeric(5, 2) check (equity_min is null or (equity_min >= 0 and equity_min <= 100)),
  equity_max numeric(5, 2) check (equity_max is null or (equity_max >= 0 and equity_max <= 100)),
  linkedin_url text,
  github_url text,
  portfolio_url text,
  company_type text check (company_type is null or company_type in ('student_project', 'registered_company')),
  -- Users can write this row themselves, so it only holds user-controlled states.
  -- A verification outcome must live somewhere users cannot write.
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  completeness smallint not null default 0 check (completeness between 0 and 100),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (equity_min is null or equity_max is null or equity_min <= equity_max),
  check (status = 'draft' or completeness = 100)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists cofounder_profiles_set_updated_at on public.cofounder_profiles;
create trigger cofounder_profiles_set_updated_at before update on public.cofounder_profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.cofounder_profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "Users create own profile" on public.profiles;
create policy "Users create own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Users read own cofounder profile" on public.cofounder_profiles;
create policy "Users read own cofounder profile" on public.cofounder_profiles
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users create own cofounder profile" on public.cofounder_profiles;
create policy "Users create own cofounder profile" on public.cofounder_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own cofounder profile" on public.cofounder_profiles;
create policy "Users update own cofounder profile" on public.cofounder_profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
