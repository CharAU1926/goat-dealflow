"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Loader2, Mail } from "lucide-react";

export type WaitlistRole = "investor" | "founder";

type WaitlistFormProps = { initialRole?: WaitlistRole };

const successMessage = "Access requested. Priority invitations roll out weekly.";

export default function WaitlistForm({ initialRole = "investor" }: WaitlistFormProps) {
  const [role, setRole] = useState<WaitlistRole>(initialRole);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError("Enter a valid work email to request access.");
      setIsSubmitted(false);
      return;
    }
    setError("");
    setIsSubmitting(true);
    window.setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 850);
  }

  return (
    <div id="waitlist" className="max-w-xl">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"><span className="h-px w-7 bg-emerald-400" />Join the private beta</div>
      {isSubmitted ? (
        <div className="flex min-h-[78px] items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/8 px-4 text-sm text-emerald-100 shadow-[0_0_36px_rgba(52,211,153,0.08)]"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-slate-950"><Check size={16} strokeWidth={3} /></span><span>{successMessage}</span></div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-slate-900/70 p-1">
            {([["investor", "Investor / Angel"], ["founder", "Startup Founder"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setRole(value)} className={`rounded-md px-3 py-2 text-left text-xs font-medium transition-colors ${role === value ? "bg-slate-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`} aria-pressed={role === value}>{label}</button>)}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative flex min-h-12 flex-1 items-center rounded-lg border border-white/10 bg-slate-900/75 transition-colors focus-within:border-emerald-400/60"><Mail className="ml-4 text-slate-500" size={17} aria-hidden="true" /><span className="sr-only">Work email</span><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); if (error) setError(""); }} placeholder={role === "investor" ? "you@fund.com" : "you@startup.com"} className="h-full w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-600" aria-invalid={Boolean(error)} aria-describedby={error ? "email-error" : undefined} /></label>
            <button type="submit" disabled={isSubmitting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition-all hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-70">{isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}{isSubmitting ? "Requesting" : "Request Early Access"}</button>
          </div>
          {error && <p id="email-error" className="mt-2 text-xs text-rose-300">{error}</p>}
          <p className="mt-3 text-xs text-slate-600">No noise. Just the right opportunities, when they are ready.</p>
        </form>
      )}
    </div>
  );
}