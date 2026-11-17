"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Loader2, Mail } from "lucide-react";
import { requestMagicLink, signInWithGoogle } from "@/app/actions/auth";
import { AgeGateLabel, ConsentCheckbox } from "@/components/auth/auth-shell";

type LoginFormProps = { next: string | null; initialError: string; flag?: { startupId: string; campaign: string | null }; heading?: string; intro?: string };

const RESEND_COOLDOWN = 60;

export default function LoginForm({ next, initialError, flag, heading = "Sign in to GOAT", intro = "Use Google or a one-time email link. No password needed." }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState<"google" | "email" | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const locked = !ageConfirmed || pending !== null;
  const consent = { ageConfirmed, marketingOptIn, next, flag };

  async function handleGoogle() {
    setError("");
    setPending("google");
    try {
      const response = await signInWithGoogle(consent);
      if (response && !response.success) {
        setError(response.error);
        setPending(null);
      }
    } catch (submissionError) {
      console.error("Google sign-in failed", submissionError);
      setError("Google sign-in is unavailable right now. Please use an email link instead.");
      setPending(null);
    }
  }

  async function handleMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setPending("email");
    try {
      const response = await requestMagicLink({ ...consent, email: trimmedEmail });
      if (response.success) {
        setSentTo(trimmedEmail);
        setCooldown(RESEND_COOLDOWN);
      } else {
        setError(response.error);
        if (response.retryAfter) setCooldown(response.retryAfter);
      }
    } catch (submissionError) {
      console.error("Magic link request failed", submissionError);
      setError("We couldn't send your sign-in link. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-black/40 sm:p-8">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300"><span className="h-px w-7 bg-emerald-400" />Private beta</div>
      <h1 id="login-heading" className="text-2xl font-semibold tracking-tight text-white">{heading}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">{intro}</p>

      <div className="mt-6 space-y-3 rounded-xl border border-white/10 bg-slate-950/60 p-4">
        <ConsentCheckbox id="age-gate" checked={ageConfirmed} onChange={setAgeConfirmed}><AgeGateLabel /></ConsentCheckbox>
        <ConsentCheckbox id="marketing-opt-in" checked={marketingOptIn} onChange={setMarketingOptIn}>
          <span className="text-slate-500">Optional:</span> send me occasional GOAT product news and event invitations. You can unsubscribe at any time.
        </ConsentCheckbox>
      </div>

      <button type="button" onClick={handleGoogle} disabled={locked} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white px-5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
        {pending === "google" ? <Loader2 size={16} className="animate-spin" /> : <GoogleMark />}
        {pending === "google" ? "Redirecting to Google" : "Continue with Google"}
      </button>

      <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600"><span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" /></div>

      {sentTo ? (
        <div role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-400/8 p-4 text-sm text-emerald-100">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-slate-950"><Check size={16} strokeWidth={3} /></span>
            <p className="leading-6">Check your inbox. We sent a sign-in link to <span className="font-medium text-white">{sentTo}</span>.</p>
          </div>
          <button type="button" onClick={() => setSentTo("")} disabled={cooldown > 0} className="mt-3 text-xs text-slate-400 underline decoration-slate-600 underline-offset-4 transition-colors hover:text-emerald-300 disabled:cursor-not-allowed disabled:no-underline disabled:hover:text-slate-400">
            {cooldown > 0 ? `You can request another link in ${cooldown}s` : "Use a different email or resend"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleMagicLink} noValidate>
          <label className="relative flex min-h-12 items-center rounded-lg border border-white/10 bg-slate-950/60 transition-colors focus-within:border-emerald-400/60">
            <Mail className="ml-4 text-slate-500" size={17} aria-hidden="true" />
            <span className="sr-only">Email address</span>
            <input type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); if (error) setError(""); }} placeholder="you@company.com" className="h-full w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-600" aria-invalid={Boolean(error)} aria-describedby={error ? "login-error" : undefined} />
          </label>
          <button type="submit" disabled={locked || cooldown > 0} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">
            {pending === "email" ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}
            {pending === "email" ? "Sending link" : cooldown > 0 ? `Try again in ${cooldown}s` : "Email me a magic link"}
          </button>
        </form>
      )}

      {error && <p id="login-error" role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
      {!ageConfirmed && <p className="mt-3 text-xs text-slate-600">Confirm the age and terms checkbox above to continue.</p>}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}
