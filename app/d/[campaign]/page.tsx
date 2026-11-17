import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { AuthShell } from "@/components/auth/auth-shell";
import DealDeck from "@/components/deals/deal-deck";
import { DISCLAIMER } from "@/lib/legal";
import { DECK_SIZE, TEASER_COLUMNS, normalizeCampaign, type StartupTeaser } from "@/lib/startups";

export const metadata: Metadata = { title: "Deal deck | GOAT", description: "Three verified early-stage companies, curated for investors." };

// The deck is public and identical for every visitor, so it is cached and refreshed every 5 minutes.
export const revalidate = 300;

// DK-2: this page reads as an anonymous visitor through the `startup_teasers` view, which only
// contains Tier 0 fields. MRR, burn, contact emails and evidence are not reachable from here.
// There is no campaign-pinning table yet, so every campaign gets the automatic deck: up to
// DECK_SIZE live companies, preferring funding_scope = 'all_investors' and topping up with any
// other live company (the view only ever contains verified, live ones).
async function getDeck(campaign: string | null): Promise<StartupTeaser[]> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

  const run = async (onlyAllInvestors: boolean) => {
    let query = supabase.from("startup_teasers").select(TEASER_COLUMNS);
    if (onlyAllInvestors) query = query.eq("funding_scope", "all_investors");
    const result = await query
      .order("readiness_score", { ascending: false })
      .order("verified_at", { ascending: false })
      .limit(DECK_SIZE)
      .overrideTypes<StartupTeaser[]>();
    const description = `supabase.from("startup_teasers").select("${TEASER_COLUMNS}")${onlyAllInvestors ? '.eq("funding_scope", "all_investors")' : ""}.order("readiness_score", { ascending: false }).order("verified_at", { ascending: false }).limit(${DECK_SIZE})`;
    if (result.error || !result.data?.length) {
      console.log(`[deal deck] campaign=${campaign ?? "none"} returned ${result.data?.length ?? 0} rows\n  query: ${description}\n  error: ${result.error ? JSON.stringify(result.error) : "none"}`);
    }
    return result;
  };

  const preferred = await run(true);
  const deals = preferred.data ?? [];
  if (deals.length >= DECK_SIZE || preferred.error) return deals;

  // Top up with any other live company, without repeating one already chosen.
  const fallback = await run(false);
  const seen = new Set(deals.map((deal) => deal.id));
  return [...deals, ...(fallback.data ?? []).filter((deal) => !seen.has(deal.id))].slice(0, DECK_SIZE);
}

export default async function CampaignDeckPage({ params }: PageProps<"/d/[campaign]">) {
  const campaign = normalizeCampaign((await params).campaign);
  const deals = await getDeck(campaign);

  return (
    <AuthShell wide>
      <div className="mb-8 mt-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">Investor deal deck</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Three verified companies. Thirty seconds each.</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Pass on what does not fit and flag what does. Flagged deals are saved to your account.</p>
      </div>
      <DealDeck deals={deals} campaign={campaign} />
      <p className="mt-8 text-xs leading-5 text-slate-600">{DISCLAIMER}</p>
    </AuthShell>
  );
}
