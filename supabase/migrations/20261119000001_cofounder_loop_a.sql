-- PRD v1.6 Loop A (CF-1 to CF-12, IN-2, IN-3): co-founder interest and messaging.
-- Apply after 20261119000000_deal_deck_and_startup_verification.sql.

-- 1. cofounder_interests -----------------------------------------------------------------------

create table if not exists public.cofounder_interests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (from_user_id, to_user_id),
  check (from_user_id <> to_user_id)
);

create index if not exists cofounder_interests_to_user_idx on public.cofounder_interests (to_user_id, status);

-- 2. messages (IN-2, IN-3) ---------------------------------------------------------------------

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.cofounder_interests (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_match_idx on public.messages (match_id, created_at);

-- 3. Row-level security: default deny ---------------------------------------------------------

-- With RLS on and only the policies below, everything not listed is refused: no deletes, no
-- reading other people's interests or threads, and no operator access to private messages.
alter table public.cofounder_interests enable row level security;
alter table public.messages enable row level security;

revoke all on public.cofounder_interests, public.messages from anon;
revoke delete, truncate on public.cofounder_interests, public.messages from authenticated;
revoke update on public.messages from authenticated;

-- True when the user has an operator-approved co-founder profile (CF-9).
create or replace function public.is_approved_cofounder(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cofounder_profiles where user_id = target and visibility_status = 'approved'
  );
$$;

revoke all on function public.is_approved_cofounder(uuid) from public, anon;
grant execute on function public.is_approved_cofounder(uuid) to authenticated;

drop policy if exists "Participants read their interests" on public.cofounder_interests;
create policy "Participants read their interests" on public.cofounder_interests
  for select to authenticated
  using ((select auth.uid()) in (from_user_id, to_user_id));

-- Only an approved founder can express interest, only in another approved founder, and a new
-- interest always starts as pending.
drop policy if exists "Approved founders express interest" on public.cofounder_interests;
create policy "Approved founders express interest" on public.cofounder_interests
  for insert to authenticated
  with check (
    (select auth.uid()) = from_user_id
    and status = 'pending'
    and resolved_at is null
    and public.is_approved_cofounder(from_user_id)
    and public.is_approved_cofounder(to_user_id)
  );

-- Which status changes are allowed is decided by the trigger below.
drop policy if exists "Participants update their interests" on public.cofounder_interests;
create policy "Participants update their interests" on public.cofounder_interests
  for update to authenticated
  using ((select auth.uid()) in (from_user_id, to_user_id))
  with check ((select auth.uid()) in (from_user_id, to_user_id));

-- The recipient may accept or decline a pending interest. The sender may withdraw a pending
-- interest, or re-send one they withdrew. Nothing else about the row can change, so an
-- accepted match cannot be forged and a declined one cannot be reopened by the sender.
create or replace function public.guard_cofounder_interest()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if (select auth.role()) is distinct from 'authenticated' then
    return new;
  end if;

  new.id := old.id;
  new.from_user_id := old.from_user_id;
  new.to_user_id := old.to_user_id;
  new.created_at := old.created_at;

  if caller = old.to_user_id and old.status = 'pending' and new.status in ('accepted', 'declined') then
    new.note := old.note;
    new.resolved_at := now();
  elsif caller = old.from_user_id and old.status = 'pending' and new.status = 'withdrawn' then
    new.note := old.note;
    new.resolved_at := now();
  elsif caller = old.from_user_id and old.status = 'withdrawn' and new.status = 'pending' then
    new.resolved_at := null;
  else
    raise exception 'This change to a co-founder interest is not allowed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists cofounder_interests_guard on public.cofounder_interests;
create trigger cofounder_interests_guard before update on public.cofounder_interests
  for each row execute function public.guard_cofounder_interest();

-- IN-2 / IN-3: a thread exists only between the two people of an accepted interest.
create or replace function public.is_match_participant(target_match uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cofounder_interests
    where id = target_match
      and status = 'accepted'
      and (select auth.uid()) in (from_user_id, to_user_id)
  );
$$;

revoke all on function public.is_match_participant(uuid) from public, anon;
grant execute on function public.is_match_participant(uuid) to authenticated;

drop policy if exists "Matched founders read messages" on public.messages;
create policy "Matched founders read messages" on public.messages
  for select to authenticated
  using (public.is_match_participant(match_id));

drop policy if exists "Matched founders send messages" on public.messages;
create policy "Matched founders send messages" on public.messages
  for insert to authenticated
  with check ((select auth.uid()) = sender_id and public.is_match_participant(match_id));

-- 4. Realtime ----------------------------------------------------------------------------------

-- Realtime applies the policies above, so a subscriber only receives messages they could read.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
