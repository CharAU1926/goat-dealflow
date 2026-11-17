import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle, Users } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import InterestControls, { ShareButton } from "@/components/cofounders/interest-controls";
import { destinationForRole, getProfile } from "@/lib/auth";
import { BROWSE_LIMIT, CARD_COLUMNS, INTEREST_COLUMNS, getOpeningThreshold, hasActiveFilters, interestStateFor, parseBrowseFilters, type CofounderCard, type InterestRow } from "@/lib/cofounders";
import { COMMITMENTS, COMMITMENT_LABELS, ROLES_SOUGHT, SKILL_CATEGORIES, SKILL_TAXONOMY, type Commitment } from "@/lib/founder-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Find a co-founder | GOAT" };

const selectClass = "min-h-11 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition-colors focus:border-emerald-400/60";
const labelClass = "mb-2 block text-xs font-medium text-slate-400";

export default async function CofoundersPage({ searchParams }: PageProps<"/cofounders">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/cofounders");

  // Co-founder discovery is for founders (and operators, who review the profiles).
  const profile = await getProfile(supabase, user.id);
  if (profile?.role !== "founder" && profile?.role !== "operator") redirect(destinationForRole(profile?.role ?? null));

  const filters = parseBrowseFilters(await searchParams);
  const threshold = getOpeningThreshold();

  // Row-level security only returns operator-approved profiles to other users (CF-9).
  const [{ count }, { data: own }] = await Promise.all([
    supabase.from("cofounder_profiles").select("user_id", { count: "exact", head: true }).eq("visibility_status", "approved"),
    supabase.from("cofounder_profiles").select("visibility_status").eq("user_id", user.id).maybeSingle<{ visibility_status: string }>(),
  ]);
  const approvedCount = count ?? 0;
  const isOpen = profile.role === "operator" || approvedCount >= threshold;
  const canExpress = own?.visibility_status === "approved";

  let cards: CofounderCard[] = [];
  let interests: InterestRow[] = [];
  if (isOpen) {
    let query = supabase.from("cofounder_profiles").select(CARD_COLUMNS).eq("visibility_status", "approved").neq("user_id", user.id);
    if (filters.role) query = query.contains("roles_sought", [filters.role]);
    if (filters.skills.length > 0) query = query.contains("skills", filters.skills);
    if (filters.commitment) query = query.eq("commitment", filters.commitment);
    if (filters.location) query = query.ilike("location", `%${filters.location}%`);

    const [cardResult, interestResult] = await Promise.all([
      query.order("updated_at", { ascending: false }).limit(BROWSE_LIMIT).overrideTypes<CofounderCard[]>(),
      supabase.from("cofounder_interests").select(INTEREST_COLUMNS).overrideTypes<InterestRow[]>(),
    ]);
    if (cardResult.error) console.error("Co-founder browse error:", cardResult.error);
    cards = cardResult.data ?? [];
    interests = interestResult.data ?? [];
  }

  const waitingForYou = interests.filter((interest) => interest.status === "pending" && interest.to_user_id === user.id).length;
  const conversations = interests.filter((interest) => interest.status === "accepted");

  return (
    <AuthShell wide>
      <div className="mb-8 mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">Co-founder discovery</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Find who you build with.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Every profile here has been reviewed by a GOAT operator. Express interest, and message each other once it is accepted.</p>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-xs">
          <Link href="/founder/profile" className="text-slate-400 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">My profile</Link>
          <form action={signOut}>
            <button type="submit" className="text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">Sign out</button>
          </form>
        </div>
      </div>

      {!isOpen ? (
        <section className="rounded-2xl border border-emerald-400/20 bg-slate-900 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300"><Users size={18} /></span>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">Waiting for cohort launch</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">Co-founder browse opens once {threshold} founder profiles are approved, so there is a real choice from day one. Share GOAT to unlock it sooner.</p>
          <div className="mt-6 flex items-end justify-between gap-4">
            <p className="text-3xl font-semibold tracking-tight text-white">{approvedCount}<span className="text-base font-normal text-slate-500"> of {threshold} approved founders</span></p>
          </div>
          <div role="progressbar" aria-label="Approved founders" aria-valuemin={0} aria-valuemax={threshold} aria-valuenow={approvedCount} className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, Math.round((approvedCount / Math.max(threshold, 1)) * 100))}%` }} />
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <ShareButton />
            {!canExpress && <Link href="/founder/profile" className="text-xs text-slate-400 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">Complete your profile to be counted</Link>}
          </div>
        </section>
      ) : (
        <>
          {(waitingForYou > 0 || conversations.length > 0) && (
            <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-white/10 bg-slate-900 p-4 text-xs text-slate-400">
              {waitingForYou > 0 && <span className="text-amber-200">{waitingForYou} founder{waitingForYou === 1 ? " is" : "s are"} waiting for your answer below</span>}
              {conversations.map((interest, index) => (
                <Link key={interest.id} href={`/messages/${interest.id}`} className="inline-flex items-center gap-1.5 text-emerald-300 underline decoration-emerald-300/30 underline-offset-4 hover:text-emerald-200"><MessageCircle size={13} />Conversation {index + 1}</Link>
              ))}
            </div>
          )}

          <form method="get" className="mb-5 rounded-2xl border border-white/10 bg-slate-900 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="role" className={labelClass}>Role sought</label>
                <select id="role" name="role" defaultValue={filters.role ?? ""} className={selectClass}>
                  <option value="" className="bg-slate-900">Any role</option>
                  {ROLES_SOUGHT.map((role) => <option key={role} value={role} className="bg-slate-900">{role}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="commitment" className={labelClass}>Commitment</label>
                <select id="commitment" name="commitment" defaultValue={filters.commitment ?? ""} className={selectClass}>
                  <option value="" className="bg-slate-900">Any commitment</option>
                  {COMMITMENTS.map((commitment) => <option key={commitment} value={commitment} className="bg-slate-900">{COMMITMENT_LABELS[commitment]}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="location" className={labelClass}>Location</label>
                <input id="location" name="location" defaultValue={filters.location} maxLength={60} placeholder="Nicosia, Limassol, Athens" className={`${selectClass} placeholder:text-slate-600`} />
              </div>
            </div>
            <details className="mt-4" open={filters.skills.length > 0}>
              <summary className="cursor-pointer text-xs font-medium text-slate-400 transition-colors hover:text-slate-200">Skills{filters.skills.length > 0 ? ` (${filters.skills.length} selected, must have all)` : " (must have all selected)"}</summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {SKILL_CATEGORIES.map((category) => (
                  <fieldset key={category}>
                    <legend className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{category}</legend>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {SKILL_TAXONOMY[category].map((skill) => (
                        <label key={skill} className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                          <input type="checkbox" name="skills" value={skill} defaultChecked={(filters.skills as string[]).includes(skill)} className="h-4 w-4 cursor-pointer accent-emerald-400" />
                          {skill}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            </details>
            <div className="mt-5 flex items-center justify-end gap-4">
              {hasActiveFilters(filters) && <Link href="/cofounders" className="text-xs text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-slate-300">Clear filters</Link>}
              <button type="submit" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-400 px-4 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-300">Apply filters</button>
            </div>
          </form>

          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{cards.length} founder{cards.length === 1 ? "" : "s"}{hasActiveFilters(filters) ? " match your filters" : ""}</p>
          <div className="grid gap-5 sm:grid-cols-2">
            {cards.map((card) => (
              <article key={card.user_id} className="flex flex-col rounded-2xl border border-white/10 bg-slate-900 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{card.name}</h2>
                    <p className="mt-0.5 text-sm text-slate-400">{card.headline}</p>
                  </div>
                  {card.commitment && card.commitment in COMMITMENT_LABELS && <span className="shrink-0 rounded-lg border border-indigo-400/25 bg-indigo-400/10 px-2.5 py-1 text-xs font-medium text-indigo-200">{COMMITMENT_LABELS[card.commitment as Commitment]}</span>}
                </div>
                <p className="mt-2 text-xs text-slate-500">{[card.location, (card.languages ?? []).join(", ")].filter(Boolean).join(" · ")}</p>
                <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-400">{card.bio}</p>
                {(card.roles_sought ?? []).length > 0 && <p className="mt-4 text-xs text-slate-500">Looking for: <span className="text-slate-200">{(card.roles_sought ?? []).join(", ")}</span></p>}
                <div className="mb-5 mt-3 flex flex-wrap gap-2">{(card.skills ?? []).slice(0, 6).map((skill) => <span key={skill} className="rounded-md bg-white/6 px-2.5 py-1 text-xs text-slate-300">{skill}</span>)}</div>
                <div className="mt-auto border-t border-white/10 pt-5">
                  <InterestControls userId={card.user_id} name={card.name} state={interestStateFor(user.id, card.user_id, interests)} canExpress={canExpress} />
                </div>
              </article>
            ))}
          </div>
          {cards.length === 0 && <p className="rounded-2xl border border-white/10 bg-slate-900 p-8 text-center text-sm text-slate-500">{hasActiveFilters(filters) ? "No founders match every filter. Try removing one." : "No other approved founders yet."}</p>}
        </>
      )}
    </AuthShell>
  );
}
