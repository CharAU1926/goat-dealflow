-- PRD v1.6 PR-3: automated screening flags on startup and co-founder submissions.
-- Apply after 20261121000000_waitlist_management.sql.

alter table public.startups
  add column if not exists screening_flags jsonb not null default '[]'::jsonb,
  add column if not exists screened_at timestamptz;

alter table public.cofounder_profiles
  add column if not exists screening_flags jsonb not null default '[]'::jsonb,
  add column if not exists screened_at timestamptz;

-- Flags are written by the server with the service role after each submission. A signed-in
-- applicant can already write their own row, so stop them setting or clearing the flags.
create or replace function public.guard_screening_flags()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) is distinct from 'authenticated' or public.is_operator() then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.screening_flags := old.screening_flags;
    new.screened_at := old.screened_at;
  else
    new.screening_flags := '[]'::jsonb;
    new.screened_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists startups_guard_screening on public.startups;
create trigger startups_guard_screening before insert or update on public.startups
  for each row execute function public.guard_screening_flags();

drop trigger if exists cofounder_profiles_guard_screening on public.cofounder_profiles;
create trigger cofounder_profiles_guard_screening before insert or update on public.cofounder_profiles
  for each row execute function public.guard_screening_flags();
