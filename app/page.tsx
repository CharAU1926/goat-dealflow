"use client";

import { useState } from "react";
import { ArrowUpRight, Check, ChevronRight, CircleCheck, Flag, Gauge, Layers3, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import WaitlistForm, { type WaitlistRole } from "@/components/waitlist-form";

type LegalDocument = "privacy" | "terms";

const legalContent: Record<LegalDocument, { title: string; paragraphs: string[] }> = {
  privacy: {
    title: "Privacy Policy",
    paragraphs: [
      "GOAT Deal Flow is the data controller for waitlist information collected through this site, with its operating base in Nicosia, Cyprus.",
      "We collect your email address and selected role only to manage early-access invitations and communicate about the GOAT private beta. We do not sell your personal data or use it for unrelated advertising.",
      "You may request access, correction, or deletion of your waitlist information by contacting contact@goatdealflow.eu.",
    ],
  },
  terms: {
    title: "Terms of Service",
    paragraphs: [
      "GOAT is a software workflow and introductions platform. Access is provided on an invitation basis and may change as the product develops.",
      "Introductions only, not investment advice. GOAT does not provide investment advice, broker transactions, or hold client funds. All investment decisions are made independently by users.",
      "By joining the waitlist, you agree that GOAT may use the submitted contact details only to manage access and relevant product communications.",
    ],
  },
};

export default function Home() {
  const [formRole, setFormRole] = useState<WaitlistRole>("investor");
  const [previewStatus, setPreviewStatusState] = useState("");
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);

  function focusWaitlist(role: WaitlistRole) {
    setFormRole(role);
    window.requestAnimationFrame(() => {
      document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function setPreviewStatus(status: string) {
    setPreviewStatusState(status);
  }

  function requestAccess(status = "Intro Request Pending") {
    setPreviewStatus(status === "Intro request received" ? "Intro Request Pending" : status);
  }

  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 text-slate-100 selection:bg-emerald-400 selection:text-slate-950">
      <div className="pointer-events-none fixed inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-12"><a href="#top" className="flex items-center gap-3" aria-label="GOAT home"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400 text-lg font-black italic text-slate-950">G</span><span className="text-lg font-bold tracking-[0.18em] text-white">GOAT</span><span className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">Beta</span></a><nav className="flex items-center gap-4 text-sm sm:gap-6" aria-label="Primary navigation"><button type="button" onClick={() => focusWaitlist("investor")} className="hidden text-slate-500 transition-colors hover:text-white sm:block">Investor Login</button><button type="button" onClick={() => focusWaitlist("investor")} className="hidden rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-emerald-200 transition-colors hover:bg-emerald-400/20 sm:block">Early Access</button><button type="button" onClick={() => focusWaitlist("founder")} className="group flex items-center gap-1 text-slate-400 transition-colors hover:text-white">For Founders <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" /></button></nav></header>
      <main id="top" className="relative z-10 mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-12">
        <section className="grid gap-14 pb-24 pt-16 lg:grid-cols-[minmax(0,0.94fr)_minmax(440px,0.86fr)] lg:items-center lg:gap-20 lg:pb-32 lg:pt-24"><div><div className="mb-7 flex items-center gap-3 text-[11px] font-bold tracking-[0.22em] text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.85)]" />VENTURE DISCOVERY ENGINE</div><h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-[5.25rem]">Curated European Deal Flow for <span className="text-emerald-300">High-Conviction</span> Investors.</h1><p className="mt-7 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">Discover, triage, and connect with top-tier early-stage founders across Cyprus, Greece, and Europe in seconds.</p><div className="mt-10"><WaitlistForm key={formRole} initialRole={formRole} /></div></div>
          <div className="relative"><div className="absolute -inset-8 rounded-full bg-indigo-500/10 blur-3xl" /><article className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl shadow-black/30 sm:p-7"><div className="mb-7 flex items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300"><CircleCheck size={13} />Verified NTUA Spinout</div><h2 className="text-2xl font-semibold tracking-tight text-white">Aether Dynamics</h2><p className="mt-1 text-sm text-slate-500">Autonomous Maritime Logistics</p></div><span className="rounded-lg border border-indigo-400/25 bg-indigo-400/10 px-2.5 py-1 text-xs font-medium text-indigo-200">Pre-Seed</span></div><div className="mb-6 flex flex-wrap gap-2"><span className="rounded-md bg-white/6 px-2.5 py-1 text-xs text-slate-300">Maritime / AI</span><span className="rounded-md bg-white/6 px-2.5 py-1 text-xs text-slate-300">Cyprus</span></div><div className="grid grid-cols-3 divide-x divide-white/10 border-y border-white/10 py-5"><Metric value="€350k" label="Target" /><Metric value="€14k" label="MRR" /><Metric value="12" label="Pilots Active" /></div><div className="mt-6 flex flex-wrap gap-2">{[[X, "Pass"], [Flag, "Flag for Later"], [ArrowUpRight, "Request Intro"]].map(([Icon, label], index) => <button key={label as string} type="button" onClick={() => index === 2 ? requestAccess("Intro request received") : setPreviewStatus(label as string)} className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${index === 2 ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20" : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"}`}><Icon size={14} />{label as string}</button>)}</div>{previewStatus && <div className="mt-4 flex items-center gap-2 text-xs text-emerald-300"><Check size={14} />{previewStatus}</div>}<div className="mt-7 flex items-center justify-between border-t border-white/10 pt-5 text-[10px] uppercase tracking-wider text-slate-600"><span>Signal detected 04:32 ago</span><span className="flex items-center gap-1.5 text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Live</span></div></article></div>
        <div className="lg:col-start-2"><DealPreviewDeck onRequestAccess={() => focusWaitlist("investor")} /></div>
        </section>
        <section id="for-founders" className="border-y border-white/8 py-16 lg:py-20"><div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-300">The operating layer</p><h2 className="max-w-md text-3xl font-semibold tracking-tight text-white">Less noise. Better decisions.</h2></div><p className="max-w-sm text-sm leading-6 text-slate-500">A sharper starting point for the conversations that matter on both sides of the table.</p></div><div className="grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 md:grid-cols-3">{[[Layers3, "01", "Zero-Friction Discovery", "A focused stream of relevant companies, matched to the conviction you are building."], [Gauge, "02", "Verified Readiness Score", "Structured signals across traction, team, market, and round quality before you spend a minute."], [Users, "03", "Direct Introductions", "Move from signal to conversation with warm, intentional paths to the people behind the company."]].map(([Icon, number, title, copy]) => <div key={title as string} className="bg-slate-900/90 p-6 lg:p-8"><div className="mb-12 flex items-center justify-between text-xs text-slate-600"><Icon size={19} className="text-emerald-300" /><span>{number as string}</span></div><h3 className="mb-3 text-lg font-semibold text-white">{title as string}</h3><p className="text-sm leading-6 text-slate-500">{copy as string}</p></div>)}</div></section>
      </main>
      <footer className="relative z-10 mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12"><div className="grid gap-10 border-b border-white/8 pb-10 lg:grid-cols-[1.3fr_0.7fr]"><div><div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck size={16} className="text-emerald-300" />Responsible by design</div><p className="max-w-2xl text-xs leading-6 text-slate-500">GOAT is a software workflow and introductions platform. GOAT does not provide investment advice, broker transactions, or hold client funds. All investment decisions are made independently.</p></div><div className="lg:text-right"><p className="text-xs font-medium text-slate-300">Built in the EU <span className="px-1 text-emerald-400">•</span> GDPR Compliant</p><a href="mailto:contact@goatdealflow.eu" className="mt-2 inline-block text-sm text-slate-400 transition-colors hover:text-emerald-300">contact@goatdealflow.eu</a><p className="mt-1 text-xs text-slate-600">Nicosia <span className="px-1">•</span> Athens</p></div></div><div className="flex flex-col justify-between gap-3 pt-6 text-xs text-slate-600 sm:flex-row"><span>© 2026 GOAT Deal Flow</span><span className="flex items-center gap-1.5"><Sparkles size={13} className="text-indigo-300" />Built for the next category leaders</span></div><div className="mt-6 flex gap-5 text-xs text-slate-600"><button type="button" onClick={() => setLegalDocument("privacy")} className="transition-colors hover:text-slate-300">Privacy Policy</button><button type="button" onClick={() => setLegalDocument("terms")} className="transition-colors hover:text-slate-300">Terms of Service</button></div></footer>
      {legalDocument && <LegalDialog document={legalDocument} onClose={() => setLegalDocument(null)} />}
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) { return <div className="px-3 first:pl-0 last:pr-0"><p className="text-lg font-semibold tracking-tight text-white sm:text-xl">{value}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{label}</p></div>; }

function LegalDialog({ document, onClose }: { document: LegalDocument; onClose: () => void }) {
  const content = legalContent[document];
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="legal-dialog-title" className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-black/50 sm:p-8"><div className="mb-6 flex items-start justify-between gap-5"><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">GOAT Deal Flow</p><h2 id="legal-dialog-title" className="text-2xl font-semibold text-white">{content.title}</h2></div><button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-md p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"><X size={18} /></button></div><div className="space-y-4 text-sm leading-6 text-slate-400">{content.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div><button type="button" onClick={onClose} className="mt-8 inline-flex min-h-10 items-center justify-center rounded-md bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300">Close</button></section></div>;
}

type StartupDeal = {
  name: string;
  description: string;
  stage: string;
  target: string;
  mrr: string;
  traction: string;
  location: string;
  verification: string;
  category: string;
};

const startupDeals: StartupDeal[] = [
  { name: "Aether Dynamics", description: "Autonomous Maritime Logistics", stage: "Pre-Seed", target: "€350k", mrr: "€14k", traction: "12 Pilots", location: "Cyprus / NTUA", verification: "Verified NTUA Spinout", category: "Maritime / AI" },
  { name: "PulseBio", description: "AI Oncology Screening", stage: "Seed", target: "€600k", mrr: "€28k", traction: "6 Hospital Trials", location: "Athens / UCY", verification: "Verified UCY Research", category: "Healthtech / AI" },
  { name: "Khora Supply", description: "Cold-Chain IoT Telemetry", stage: "Pre-Seed", target: "€250k", mrr: "€9k", traction: "4 Fleet Contracts", location: "Limassol", verification: "Verified Founder-Led", category: "Supply Chain / IoT" },
];

function DealPreviewDeck({ onRequestAccess }: { onRequestAccess: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [successBadge, setSuccessBadge] = useState("");
  const currentDeal = startupDeals[currentIndex];

  function advance(action: "pass" | "flag" | "intro") {
    if (isExiting) return;
    setSuccessBadge(action === "flag" ? "Deal Flagged" : action === "intro" ? "Intro Request Pending" : "");
    setIsExiting(true);
    window.setTimeout(() => {
      setCurrentIndex((index) => index + 1);
      setIsExiting(false);
      setSuccessBadge("");
    }, 420);
  }

  function replay() {
    setCurrentIndex(0);
    setIsExiting(false);
    setSuccessBadge("");
  }

  return (
    <div className="w-full max-w-xl lg:ml-auto">
      {currentDeal ? <>
        <div className="mb-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500"><span>Daily deal preview</span><span className="text-emerald-300">Preview {currentIndex + 1} of {startupDeals.length}</span></div>
        <AnimatePresence mode="wait">
          <motion.article key={currentDeal.name} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -48, rotate: -2 }} transition={{ duration: 0.3, ease: "easeOut" }} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl shadow-black/30 sm:p-7"><div className="mb-7 flex items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300"><CircleCheck size={13} />{currentDeal.verification}</div><h2 className="text-2xl font-semibold tracking-tight text-white">{currentDeal.name}</h2><p className="mt-1 text-sm text-slate-500">{currentDeal.description}</p></div><span className="rounded-lg border border-indigo-400/25 bg-indigo-400/10 px-2.5 py-1 text-xs font-medium text-indigo-200">{currentDeal.stage}</span></div><div className="mb-6 flex flex-wrap gap-2"><span className="rounded-md bg-white/6 px-2.5 py-1 text-xs text-slate-300">{currentDeal.category}</span><span className="rounded-md bg-white/6 px-2.5 py-1 text-xs text-slate-300">{currentDeal.location}</span></div><div className="grid grid-cols-3 divide-x divide-white/10 border-y border-white/10 py-5"><Metric value={currentDeal.target} label="Target" /><Metric value={currentDeal.mrr} label="MRR" /><Metric value={currentDeal.traction} label="Traction" /></div><div className="mt-6 flex flex-wrap gap-2"><button type="button" disabled={isExiting} onClick={() => advance("pass")} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200 disabled:opacity-50"><X size={14} />Pass</button><button type="button" disabled={isExiting} onClick={() => advance("flag")} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200 disabled:opacity-50"><Flag size={14} />Flag for Later</button><button type="button" disabled={isExiting} onClick={() => advance("intro")} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-400/20 disabled:opacity-50"><ArrowUpRight size={14} />Request Intro</button></div>{successBadge && <div className="mt-4 flex items-center gap-2 text-xs text-emerald-300"><Check size={14} />{successBadge}</div>}<div className="mt-7 flex items-center justify-between border-t border-white/10 pt-5 text-[10px] uppercase tracking-wider text-slate-600"><span>Signal detected 04:32 ago</span><span className="flex items-center gap-1.5 text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Live</span></div></motion.article>
        </AnimatePresence>
      </> : <div className="rounded-2xl border border-emerald-400/20 bg-slate-900/90 p-6 shadow-2xl shadow-black/30 sm:p-8"><div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-slate-950"><Check size={18} strokeWidth={3} /></div><h2 className="max-w-sm text-2xl font-semibold tracking-tight text-white">You&apos;re all caught up for today.</h2><p className="mt-3 max-w-md text-sm leading-6 text-slate-400">Join 120+ angels and VCs receiving verified, curated deal flow directly on their phones.</p><button type="button" onClick={onRequestAccess} className="mt-7 inline-flex items-center gap-2 rounded-md bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300">Get Full Beta Access <ArrowUpRight size={15} /></button><button type="button" onClick={replay} className="mt-5 block text-xs text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">↻ Replay Preview Deck</button></div>}
    </div>
  );
}
