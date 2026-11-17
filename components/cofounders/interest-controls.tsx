"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Handshake, Loader2, MessageCircle, Send, X } from "lucide-react";
import { expressInterest, respondToInterest, type InterestActionResult } from "@/app/actions/cofounders";
import { NOTE_MAX_LENGTH, type InterestState } from "@/lib/cofounders";

const primaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-xs font-medium text-slate-200 transition-colors hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

type InterestControlsProps = { userId: string; name: string; state: InterestState; canExpress: boolean };

export default function InterestControls({ userId, name, state, canExpress }: InterestControlsProps) {
  const router = useRouter();
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNoteOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setIsNoteOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isNoteOpen]);

  async function run(key: string, action: () => Promise<InterestActionResult>) {
    setError("");
    setPending(key);
    try {
      const response = await action();
      if (!response.success) return setError(response.error);
      setIsNoteOpen(false);
      setNote("");
      // An acceptance opens the conversation straight away; everything else refreshes the card.
      if (response.matchId) router.push(`/messages/${response.matchId}`);
      else router.refresh();
    } catch (caught) {
      console.error("Interest action failed", caught);
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;
  const spinner = (key: string, icon: React.ReactNode) => (pending === key ? <Loader2 size={14} className="animate-spin" /> : icon);

  return (
    <div>
      {state.kind === "none" && (
        canExpress
          ? <button type="button" onClick={() => { setError(""); setIsNoteOpen(true); }} disabled={busy} className={primaryButton}><Handshake size={14} />Express Interest</button>
          : <p className="text-xs leading-5 text-slate-500">Your own profile must be approved before you can express interest. <Link href="/founder/profile" className="text-slate-300 underline decoration-slate-600 underline-offset-2 hover:text-emerald-300">Open your profile</Link></p>
      )}

      {state.kind === "sent" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300"><Check size={14} />Interest sent</span>
          <button type="button" onClick={() => run("withdraw", () => respondToInterest({ interestId: state.interestId, action: "withdraw" }))} disabled={busy} className="text-xs text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-slate-300 disabled:opacity-40">{pending === "withdraw" ? "Withdrawing" : "Withdraw"}</button>
        </div>
      )}

      {state.kind === "received" && (
        <div>
          <p className="text-xs font-medium text-amber-200">{name} is interested in working with you</p>
          {state.note && <p className="mt-2 rounded-lg border border-white/10 bg-slate-950/60 p-3 text-xs leading-5 text-slate-300">{state.note}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => run("accept", () => respondToInterest({ interestId: state.interestId, action: "accept" }))} disabled={busy} className={primaryButton}>{spinner("accept", <Check size={14} strokeWidth={3} />)}Accept</button>
            <button type="button" onClick={() => run("decline", () => respondToInterest({ interestId: state.interestId, action: "decline" }))} disabled={busy} className={secondaryButton}>{spinner("decline", <X size={14} />)}Decline</button>
          </div>
        </div>
      )}

      {state.kind === "matched" && <Link href={`/messages/${state.interestId}`} className={primaryButton}><MessageCircle size={14} />Open Conversation</Link>}
      {state.kind === "closed" && <p className="text-xs text-slate-500">Not available to connect</p>}

      {error && !isNoteOpen && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}

      {isNoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsNoteOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby={`interest-title-${userId}`} className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-black/50 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Express interest</p>
                <h2 id={`interest-title-${userId}`} className="text-xl font-semibold text-white">Introduce yourself to {name}</h2>
              </div>
              <button type="button" onClick={() => setIsNoteOpen(false)} aria-label="Close" className="rounded-md p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"><X size={18} /></button>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">Add a short note. You can message each other once {name} accepts.</p>
            <label htmlFor={`interest-note-${userId}`} className="sr-only">Note</label>
            <textarea id={`interest-note-${userId}`} value={note} onChange={(event) => setNote(event.target.value)} rows={4} maxLength={NOTE_MAX_LENGTH} autoFocus placeholder="What caught your eye, and what you are building." className="mt-4 w-full resize-none rounded-lg border border-white/10 bg-slate-950/60 px-3 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-400/60" />
            <p className="mt-1 text-right text-[10px] text-slate-600">{note.length} / {NOTE_MAX_LENGTH}</p>
            {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setIsNoteOpen(false)} disabled={busy} className={secondaryButton}>Cancel</button>
              <button type="button" onClick={() => run("express", () => expressInterest({ toUserId: userId, note }))} disabled={busy} className={primaryButton}>{spinner("express", <Send size={14} />)}Send Interest</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.origin;
    try {
      if (navigator.share) await navigator.share({ title: "GOAT", text: "Find your co-founder on GOAT.", url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // The share sheet was dismissed, or clipboard access was refused: nothing to report.
    }
  }

  return <button type="button" onClick={share} className={primaryButton}>{copied ? <Check size={14} strokeWidth={3} /> : <Send size={14} />}{copied ? "Link copied" : "Share GOAT"}</button>;
}
