import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bookmark, ExternalLink, FileText, Globe, Lock, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { saveToPipeline } from "@/app/actions/pipeline";
import { AuthShell } from "@/components/auth/auth-shell";
import ContactButton from "@/components/deals/contact-button";
import { TeaserHeader, TeaserMetrics } from "@/components/deals/deal-deck";
import { InvestorNav } from "@/components/investor/investor-nav";
import { getProfile } from "@/lib/auth";
import { PROFILE_COLUMNS, parseMetrics, parseTeam, safeUrl, type ConfidentialRow, type StartupProfile } from "@/lib/deal-detail";
import { type VerificationStatus } from "@/lib/investor-verification";
import { DISCLAIMER } from "@/lib/legal";
import { formatFunding } from "@/lib/startups";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Company | GOAT" };

const LOCKED_NOTICE = "Confidential pitch deck and direct contact are restricted to verified investors.";

export default async function DealPage({ params }: PageProps<"/deals/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/deals/${id}`)}`);

  const profile = await getProfile(supabase, user.id);
  if (!profile?.role) redirect(`/onboarding?next=${encodeURIComponent(`/deals/${id}`)}`);
  const isInvestor = profile.role === "investor";

  // DK-9 Tier 1: any signed-in user. The view holds no contact, deck or metrics columns.
  const { data: deal } = await supabase.from("startup_profiles").select(PROFILE_COLUMNS).eq("id", id).maybeSingle<StartupProfile>();
  if (!deal) notFound();

  const [{ data: saved }, { data: investor }] = await Promise.all([
    supabase.from("saved_deals").select("id").eq("user_id", user.id).eq("startup_id", id).maybeSingle(),
    supabase.from("investor_profiles").select("verification_status").eq("user_id", user.id).maybeSingle<{ verification_status: VerificationStatus }>(),
  ]);
  const isVerifiedInvestor = isInvestor && investor?.verification_status === "verified";

  // DK-9 Tier 2: requested only for verified investors, and the database function re-checks
  // that, so an unverified user never receives these fields even if this check were removed.
  let confidential: ConfidentialRow | null = null;
  if (isVerifiedInvestor) {
    const { data } = await supabase.rpc("get_startup_confidential", { p_startup_id: id });
    confidential = ((data as ConfidentialRow[] | null) ?? [])[0] ?? null;
  }

  const team = parseTeam(deal.team_bios);
  const website = safeUrl(deal.website);
  const deckUrl = safeUrl(confidential?.pitch_deck_url ?? null);
  const metrics = parseMetrics(confidential?.confidential_metrics);

  return (
    <AuthShell wide>
      <div className="mb-4 mt-4 flex items-center justify-between gap-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">Company detail</p>
        <form action={signOut}>
          <button type="submit" className="text-xs text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">Sign out</button>
        </form>
      </div>
      {isInvestor && <InvestorNav current={null} />}

      <article className="rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/30 sm:p-7">
        <TeaserHeader deal={deal} as="h1" />
        <TeaserMetrics deal={deal} />

        {deal.description && <Block title="About"><p className="whitespace-pre-line">{deal.description}</p></Block>}
        {deal.use_of_funds && <Block title={`Use of funds · ${formatFunding(deal.funding_sought)} target`}><p className="whitespace-pre-line">{deal.use_of_funds}</p></Block>}
        {team.length > 0 && (
          <Block title="Team">
            <ul className="space-y-4">
              {team.map((member) => (
                <li key={`${member.name}-${member.role ?? ""}`}>
                  <p className="font-medium text-white">{member.name}{member.role && <span className="font-normal text-slate-500"> · {member.role}</span>}</p>
                  {member.bio && <p className="mt-1 whitespace-pre-line text-slate-400">{member.bio}</p>}
                </li>
              ))}
            </ul>
          </Block>
        )}
        {website && (
          <a href={website} target="_blank" rel="noopener noreferrer nofollow" className="mt-6 inline-flex items-center gap-2 text-sm text-emerald-300 underline decoration-emerald-300/30 underline-offset-4 transition-colors hover:text-emerald-200">
            <Globe size={15} />Website<ExternalLink size={12} />
          </a>
        )}

        {isInvestor && (
          saved ? (
            <p className="mt-6 flex items-center gap-2 text-xs text-emerald-300"><Bookmark size={14} />Saved to your pipeline · <Link href="/pipeline" className="underline underline-offset-4">View pipeline</Link></p>
          ) : (
            <form action={saveToPipeline} className="mt-6">
              <input type="hidden" name="startupId" value={deal.id} />
              <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 px-4 text-xs font-semibold text-slate-200 transition-colors hover:border-emerald-400/40 hover:text-emerald-300"><Bookmark size={14} />Save to pipeline</button>
            </form>
          )
        )}
        {!isInvestor && saved && <p className="mt-6 flex items-center gap-2 text-xs text-emerald-300"><Bookmark size={14} />Saved to your flagged deals</p>}
      </article>

      {isVerifiedInvestor ? (
        <section aria-label="Confidential information" className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5 sm:p-7">
          <p className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck size={18} className="text-emerald-300" />Confidential · verified investors only</p>

          {metrics.length > 0 ? (
            <dl className="mt-5 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2">
              {metrics.map((metric) => (
                <div key={metric.label} className="bg-slate-900 p-4">
                  <dt className="text-[10px] uppercase tracking-wider text-slate-600">{metric.label}</dt>
                  <dd className="mt-1 text-lg font-semibold text-white">{metric.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-slate-400">Detailed traction and financial metrics haven&apos;t been added yet.</p>
          )}

          {deckUrl ? (
            <a href={deckUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-medium text-white transition-colors hover:border-emerald-400/40 hover:text-emerald-300">
              <FileText size={16} />Open confidential pitch deck<ExternalLink size={12} />
            </a>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No pitch deck has been shared yet.</p>
          )}

          <div className="mt-6 border-t border-white/10 pt-5">
            <ContactButton startupId={deal.id} disabled={!confidential?.has_contact} />
            <p className="mt-3 text-xs leading-5 text-slate-500">Opens an introduction e-mail in your mail app and lets the founder know you reached out. Repeat clicks within 24 hours don&apos;t notify them again.</p>
          </div>
        </section>
      ) : (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-indigo-400/20 bg-indigo-400/5 p-5">
          <Lock size={18} className="mt-0.5 shrink-0 text-indigo-300" />
          <div>
            <p className="text-sm font-semibold text-white">{LOCKED_NOTICE}</p>
            {isInvestor && (
              <>
                <p className="mt-1 text-sm leading-6 text-slate-400">{investor?.verification_status === "pending_review" ? "Your application is in review." : "Verification takes a GOAT operator about 48 hours."}</p>
                <Link href="/investor/verification" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-emerald-400 px-4 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-300">{investor?.verification_status === "pending_review" ? "View verification status" : "Complete Verification"}</Link>
              </>
            )}
          </div>
        </div>
      )}

      <p className="mt-8 text-xs leading-5 text-slate-600">{DISCLAIMER}</p>
    </AuthShell>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</h2>
      <div className="text-sm leading-6 text-slate-300">{children}</div>
    </section>
  );
}
