import type { Metadata } from "next";
import { signOut } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { InvestorNav } from "@/components/investor/investor-nav";
import PipelineBoard, { type PipelineItem } from "@/components/investor/pipeline-board";
import { requireInvestorPage } from "@/lib/investor-session";
import { SAVED_DEAL_COLUMNS, type SavedDealRow } from "@/lib/pipeline";
import { TEASER_COLUMNS, type StartupTeaser } from "@/lib/startups";

export const metadata: Metadata = { title: "Pipeline | GOAT" };

export default async function PipelinePage() {
  const { supabase, user } = await requireInvestorPage("/pipeline");

  const { data: saved } = await supabase.from("saved_deals").select(SAVED_DEAL_COLUMNS).eq("user_id", user.id).order("updated_at", { ascending: false }).overrideTypes<SavedDealRow[]>();
  const rows = saved ?? [];
  const startupIds = rows.map((row) => row.startup_id);

  // Flags and introduction requests are separate records (SD-3); contacts are only read here to
  // label cards, and never change a deal's column.
  const [{ data: teasers }, { data: contacts }] = startupIds.length
    ? await Promise.all([
        supabase.from("startup_teasers").select(TEASER_COLUMNS).in("id", startupIds).overrideTypes<StartupTeaser[]>(),
        supabase.from("investor_contacts").select("startup_id").eq("investor_id", user.id).in("startup_id", startupIds),
      ])
    : [{ data: [] as StartupTeaser[] }, { data: [] as { startup_id: string }[] }];

  const teaserById = new Map((teasers ?? []).map((teaser) => [teaser.id, teaser]));
  const introRequested = new Set((contacts ?? []).map((contact) => contact.startup_id));

  const items: PipelineItem[] = rows.map((row) => {
    const teaser = teaserById.get(row.startup_id);
    return {
      id: row.id,
      startupId: row.startup_id,
      status: row.pipeline_status,
      notes: row.notes ?? "",
      name: teaser?.name ?? "Company no longer available",
      oneLiner: teaser?.one_liner ?? "",
      sectors: teaser?.sectors ?? [],
      stage: teaser?.stage ?? null,
      fundingSought: teaser?.funding_sought ?? null,
      available: Boolean(teaser),
      introRequested: introRequested.has(row.startup_id),
    };
  });

  return (
    <AuthShell full>
      <div className="mb-2 mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">Deal pipeline</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Your saved deals</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Track every company from first look to close. Notes are private to you. Saving a deal never contacts the company.</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="text-xs text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">Sign out</button>
        </form>
      </div>
      <InvestorNav current="/pipeline" />
      <PipelineBoard initialItems={items} />
    </AuthShell>
  );
}
