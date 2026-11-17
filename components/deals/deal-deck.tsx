"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, CircleCheck, Flag, Loader2, X } from "lucide-react";
import { flagDeal } from "@/app/actions/deals";
import LoginForm from "@/components/auth/login-form";
import { formatFunding, stageLabel, type StartupTeaser } from "@/lib/startups";

export function TeaserMetrics({ deal }: { deal: StartupTeaser }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-white/10 border-y border-white/10 py-5">
      {[[formatFunding(deal.funding_sought), "Target"], [deal.traction_signal || "Early traction", "Traction"]].map(([value, label]) => (
        <div key={label} className="px-3 first:pl-0 last:pr-0">
          <p className="text-lg font-semibold tracking-tight text-white sm:text-xl">{value}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
        </div>
      ))}
    </div>
  );
}

export function TeaserHeader({ deal, as: Heading = "h2" }: { deal: StartupTeaser; as?: "h1" | "h2" }) {
  return (
    <>
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300"><CircleCheck size={13} />Verified by GOAT</div>
          <Heading className="text-2xl font-semibold tracking-tight text-white">{deal.name}</Heading>
          <p className="mt-1 text-sm text-slate-400">{deal.one_liner}</p>
        </div>
        <span className="shrink-0 rounded-lg border border-indigo-400/25 bg-indigo-400/10 px-2.5 py-1 text-xs font-medium text-indigo-200">{stageLabel(deal.stage)}</span>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {[...(deal.sectors ?? []), deal.location].filter(Boolean).map((tag) => <span key={tag} className="rounded-md bg-white/6 px-2.5 py-1 text-xs text-slate-300">{tag}</span>)}
      </div>
    </>
  );
}

export default function DealDeck({ deals, campaign }: { deals: StartupTeaser[]; campaign: string | null }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [signInFor, setSignInFor] = useState<StartupTeaser | null>(null);
  const currentDeal = deals[currentIndex];

  useEffect(() => {
    if (!signInFor) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSignInFor(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [signInFor]);

  function pass() {
    setError("");
    setCurrentIndex((index) => index + 1);
  }

  async function flag(deal: StartupTeaser) {
    setError("");
    setPending(true);
    try {
      // A signed-in user is redirected to the deal page by the action itself.
      const response = await flagDeal({ startupId: deal.id, campaign });
      if (response?.needsAuth) setSignInFor(deal);
      else if (response) setError(response.error);
    } catch (caught) {
      console.error("Flag deal failed", caught);
      setError("We couldn't save this deal. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full">
      {currentDeal ? (
        <>
          <div className="mb-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500"><span>Curated deal deck</span><span className="text-emerald-300">Deal {currentIndex + 1} of {deals.length}</span></div>
          <AnimatePresence mode="wait">
            <motion.article key={currentDeal.id} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -48, rotate: -2 }} transition={{ duration: 0.3, ease: "easeOut" }} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/30 sm:p-7">
              <TeaserHeader deal={currentDeal} />
              <TeaserMetrics deal={currentDeal} />
              <div className="mt-6 flex flex-wrap gap-2">
                <button type="button" onClick={pass} disabled={pending} className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-white/10 px-4 text-xs font-medium text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200 disabled:opacity-50"><X size={14} />Pass</button>
                <button type="button" onClick={() => flag(currentDeal)} disabled={pending} className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-4 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-400/20 disabled:opacity-50">{pending ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}Flag for Later</button>
              </div>
              {error && <p role="alert" className="mt-4 text-xs text-rose-300">{error}</p>}
              <p className="mt-7 border-t border-white/10 pt-5 text-[10px] uppercase tracking-wider text-slate-600">Financials and founder contact are visible to verified investors only</p>
            </motion.article>
          </AnimatePresence>
        </>
      ) : (
        <div className="rounded-2xl border border-emerald-400/20 bg-slate-900 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-slate-950"><Check size={18} strokeWidth={3} /></div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">{deals.length > 0 ? "You have seen every deal in this deck." : "New deals are being verified."}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">{deals.length > 0 ? "Sign in to keep your flagged deals and get verified for full company details." : "Every company is checked by a GOAT operator before it appears here. Sign in to be first to see the next deck."}</p>
          <Link href="/login" className="mt-7 inline-flex items-center gap-2 rounded-md bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300">Sign in to GOAT <ArrowUpRight size={15} /></Link>
          {deals.length > 0 && <button type="button" onClick={() => setCurrentIndex(0)} className="mt-5 block text-xs text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">View the deck again</button>}
        </div>
      )}

      {signInFor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-5 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSignInFor(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="login-heading" className="relative w-full max-w-md">
            <button type="button" onClick={() => setSignInFor(null)} aria-label="Close sign-in" className="absolute right-3 top-3 z-10 rounded-md p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"><X size={18} /></button>
            <LoginForm next={null} initialError="" flag={{ startupId: signInFor.id, campaign }} heading={`Sign in to save ${signInFor.name}`} intro="We will save this deal to your account and take you to its company page." />
          </section>
        </div>
      )}
    </div>
  );
}
