"use client";

import { useState } from "react";
import { ChevronRight, Loader2, Rocket, TrendingUp } from "lucide-react";
import { selectRole } from "@/app/actions/auth";
import { AgeGateLabel, ConsentCheckbox } from "@/components/auth/auth-shell";
import type { UserRole } from "@/lib/auth";

const options = [
  { role: "founder", icon: Rocket, title: "Startup Founder / Co-Founder Seeker", copy: "Build your founder profile, get verified, and meet co-founders and investors." },
  { role: "investor", icon: TrendingUp, title: "Angel / Verified Investor", copy: "Review curated early-stage deal flow once your investor status is verified." },
] as const;

export default function RoleSelection({ needsAgeConfirmation, next = null }: { needsAgeConfirmation: boolean; next?: string | null }) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [error, setError] = useState("");

  const locked = pendingRole !== null || (needsAgeConfirmation && !ageConfirmed);

  async function choose(role: UserRole) {
    setError("");
    setPendingRole(role);
    try {
      const response = await selectRole({ role, ageConfirmed, next });
      if (response && !response.success) {
        setError(response.error);
        setPendingRole(null);
      }
    } catch (submissionError) {
      console.error("Role selection failed", submissionError);
      setError("We couldn't save your role. Please try again.");
      setPendingRole(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-5 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="role-dialog-title" className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-black/50 sm:p-8">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Welcome to GOAT</p>
        <h1 id="role-dialog-title" className="text-2xl font-semibold tracking-tight text-white">How will you use GOAT?</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Choose the option that fits you best. This sets up the right workspace for your account.</p>

        {needsAgeConfirmation && (
          <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/60 p-4">
            <ConsentCheckbox id="role-age-gate" checked={ageConfirmed} onChange={setAgeConfirmed}><AgeGateLabel /></ConsentCheckbox>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {options.map(({ role, icon: Icon, title, copy }) => (
            <button key={role} type="button" onClick={() => choose(role)} disabled={locked} className="group flex w-full items-center gap-4 rounded-xl border border-white/10 bg-slate-950/60 p-4 text-left transition-colors hover:border-emerald-400/40 hover:bg-emerald-400/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:bg-slate-950/60">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300"><Icon size={18} /></span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-white">{title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{copy}</span>
              </span>
              {pendingRole === role ? <Loader2 size={16} className="animate-spin text-emerald-300" /> : <ChevronRight size={16} className="text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-300" />}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mt-4 text-xs text-rose-300">{error}</p>}
      </section>
    </div>
  );
}
