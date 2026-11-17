-- Public deck (DK-2): expose funding_scope on the Tier 0 view so the deck can prefer
-- 'all_investors' companies. Appending a column keeps `create or replace view` valid and the
-- view still contains only non-sensitive fields.
-- Apply after 20261120000000_investor_workspace_loop_b.sql.

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
  verified_at,
  funding_scope
from public.startups
where verified_at is not null
  and verification_status = 'verified'
  and funding_scope in ('student_funds_only', 'all_investors');

revoke all on public.startup_teasers from public, anon, authenticated;
grant select on public.startup_teasers to anon, authenticated;

-- Sample data: the three seeded companies carry verified_at and funding_scope = 'all_investors'
-- but were left at verification_status = 'draft', so no view ever returned them.
update public.startups
set verification_status = 'verified'
where verified_at is not null
  and verification_status = 'draft'
  and funding_scope = 'all_investors'
  and name in ('Aether Dynamics', 'PulseBio', 'Khora Supply');
