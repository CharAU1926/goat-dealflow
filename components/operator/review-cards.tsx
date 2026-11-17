"use client";

import { useState } from "react";
import { AlertTriangle, Check, ExternalLink, FileSearch, Loader2, Pencil, X } from "lucide-react";
import { getEvidenceSignedUrl, reviewFounderAction, reviewInvestorAction, reviewStartupAction } from "@/app/actions/operator";
import { SCREENING_FLAG_LABELS, type ScreeningFlag } from "@/lib/screening";
import { REASON_CODES, type ReviewAction, type ReviewActionResult, type ReviewTarget } from "@/lib/operator";

export type InvestorQueueItem = {
  userId: string;
  name: string;
  email: string;
  typeLabel: string;
  firm: string | null;
  title: string | null;
  regulatedAuthority: string | null;
  fundsStudentCompanies: boolean;
  links: string[];
  evidenceFilePath: string | null;
  submittedAt: string | null;
};

export type FounderQueueItem = {
  userId: string;
  name: string;
  email: string;
  headline: string;
  bio: string;
  skills: string[];
  companyTypeLabel: string;
  linkedinUrl: string | null;
  submittedAt: string | null;
  flags: ScreeningFlag[];
};

export type StartupQueueItem = {
  startupId: string;
  founderName: string;
  founderEmail: string;
  name: string;
  oneLiner: string;
  companyTypeLabel: string;
  details: [label: string, value: string][];
  evidenceLabel: string;
  evidenceFilePath: string | null;
  submittedAt: string | null;
  flags: ScreeningFlag[];
};

const cardClass = "rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6";
const linkClass = "inline-flex items-center gap-1.5 break-all text-emerald-300 underline decoration-emerald-300/30 underline-offset-4 transition-colors hover:text-emerald-200";
const secondaryButton = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-xs font-medium text-slate-200 transition-colors hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

function EvidenceInspector({ filePath, emptyMessage }: { filePath: string | null; emptyMessage: string }) {
  const [evidence, setEvidence] = useState<{ url: string; minutes: number } | null>(null);
  const [evidenceError, setEvidenceError] = useState("");
  const [isFetching, setIsFetching] = useState(false);

  async function inspectEvidence() {
    if (!filePath) return;
    setEvidenceError("");
    setIsFetching(true);
    try {
      const response = await getEvidenceSignedUrl(filePath);
      if (response.success) setEvidence({ url: response.url, minutes: response.expiresInSeconds / 60 });
      else setEvidenceError(response.error);
    } catch (fetchError) {
      console.error("Evidence link failed", fetchError);
      setEvidenceError("Could not open the document. Please try again.");
    } finally {
      setIsFetching(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/50 p-4">
      {filePath ? (
        <>
          <button type="button" onClick={inspectEvidence} disabled={isFetching} className={secondaryButton}>
            {isFetching ? <Loader2 size={14} className="animate-spin" /> : <FileSearch size={14} />}
            Inspect Evidence Document
          </button>
          {evidence && <p className="mt-3 text-xs leading-5 text-slate-400"><a href={evidence.url} target="_blank" rel="noopener noreferrer" className={linkClass}>Open document in a new tab<ExternalLink size={12} /></a><span className="block text-slate-600">This private link expires {evidence.minutes} minutes after it was created.</span></p>}
          {evidenceError && <p role="alert" className="mt-3 text-xs text-rose-300">{evidenceError}</p>}
        </>
      ) : <p className="text-xs text-slate-500">{emptyMessage}</p>}
    </div>
  );
}

export function InvestorCard({ item }: { item: InvestorQueueItem }) {
  return (
    <article className={cardClass}>
      <CardHeader name={item.name} email={item.email} badge={item.typeLabel} submittedAt={item.submittedAt} />
      <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Detail label="Firm / network">{item.firm ?? "Not provided"}</Detail>
        {item.title && <Detail label="Title">{item.title}</Detail>}
        {item.regulatedAuthority && <Detail label="Regulated authority">{item.regulatedAuthority}</Detail>}
        <Detail label="Funds student companies">{item.fundsStudentCompanies ? "Yes" : "No"}</Detail>
        {item.links.length > 0 && (
          <Detail label="Links" wide>
            <ul className="space-y-1">{item.links.map((link) => <li key={link}><a href={link} target="_blank" rel="noopener noreferrer" className={linkClass}>{link}<ExternalLink size={12} className="shrink-0" /></a></li>)}</ul>
          </Detail>
        )}
      </dl>

      <EvidenceInspector filePath={item.evidenceFilePath} emptyMessage="No evidence document was uploaded with this application." />

      <ReviewControls target="investor" approveLabel="Approve Investor" allowReject onDecide={(action, reasonCode) => reviewInvestorAction({ investorUserId: item.userId, action, reasonCode })} />
    </article>
  );
}

export function FounderCard({ item }: { item: FounderQueueItem }) {
  return (
    <article className={cardClass}>
      <CardHeader name={item.name} email={item.email} badge={item.companyTypeLabel} submittedAt={item.submittedAt} />
      <ScreeningFlags flags={item.flags} />
      <p className="mt-5 text-sm font-medium text-slate-200">{item.headline}</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-400">{item.bio}</p>
      <div className="mt-4 flex flex-wrap gap-2">{item.skills.map((skill) => <span key={skill} className="rounded-md bg-white/6 px-2.5 py-1 text-xs text-slate-300">{skill}</span>)}</div>
      <p className="mt-4 text-sm">{item.linkedinUrl ? <a href={item.linkedinUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>LinkedIn profile<ExternalLink size={12} /></a> : <span className="text-slate-500">No LinkedIn profile provided</span>}</p>
      <ReviewControls target="founder" approveLabel="Approve Profile" onDecide={(action, reasonCode) => (action === "reject" ? Promise.resolve({ success: false, error: "Founder profiles cannot be rejected." }) : reviewFounderAction({ founderUserId: item.userId, action, reasonCode }))} />
    </article>
  );
}

export function StartupCard({ item }: { item: StartupQueueItem }) {
  return (
    <article className={cardClass}>
      <CardHeader name={item.name} email={`${item.founderName} · ${item.founderEmail}`} badge={item.companyTypeLabel} submittedAt={item.submittedAt} />
      <ScreeningFlags flags={item.flags} />
      <p className="mt-5 text-sm leading-6 text-slate-300">{item.oneLiner}</p>
      <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {item.details.map(([label, value]) => <Detail key={label} label={label}>{value}</Detail>)}
      </dl>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{item.evidenceLabel}</p>
      <div className="-mt-3"><EvidenceInspector filePath={item.evidenceFilePath} emptyMessage="No document was uploaded with this submission." /></div>
      <ReviewControls target="startup" approveLabel="Approve Startup" allowReject onDecide={(action, reasonCode) => reviewStartupAction({ startupId: item.startupId, action, reasonCode })} />
    </article>
  );
}

// PR-3: automated screening results, shown as warnings so the operator knows where to look first.
function ScreeningFlags({ flags }: { flags: ScreeningFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <div role="group" aria-label="Automated screening flags" className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/5 p-3">
      <div className="flex flex-wrap gap-2">
        {[...new Set(flags.map((flag) => flag.code))].map((code) => (
          <span key={code} className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/40 bg-amber-300/15 px-2 py-1 text-[11px] font-semibold text-amber-100"><AlertTriangle size={12} aria-hidden />[{SCREENING_FLAG_LABELS[code]}]</span>
        ))}
      </div>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-100/80">{flags.map((flag) => <li key={`${flag.code}-${flag.detail}`}>{flag.detail}</li>)}</ul>
    </div>
  );
}

function CardHeader({ name, email, badge, submittedAt }: { name: string; email: string; badge: string; submittedAt: string | null }) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <h2 className="text-lg font-semibold text-white">{name}</h2>
        <p className="mt-0.5 break-all text-sm text-slate-400">{email}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
        <span className="w-fit rounded-lg border border-indigo-400/25 bg-indigo-400/10 px-2.5 py-1 text-xs font-medium text-indigo-200">{badge}</span>
        {submittedAt && <span className="text-[10px] uppercase tracking-wider text-slate-600">Submitted {submittedAt}</span>}
      </div>
    </div>
  );
}

function Detail({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{label}</dt>
      <dd className="mt-1 text-slate-200">{children}</dd>
    </div>
  );
}

function ReviewControls({ target, approveLabel, allowReject = false, onDecide }: { target: ReviewTarget; approveLabel: string; allowReject?: boolean; onDecide: (action: ReviewAction, reasonCode: string | null) => Promise<ReviewActionResult> }) {
  const [reasonFor, setReasonFor] = useState<Exclude<ReviewAction, "approve"> | null>(null);
  const [reasonCode, setReasonCode] = useState("");
  const [pending, setPending] = useState<ReviewAction | null>(null);
  const [error, setError] = useState("");

  async function decide(action: ReviewAction) {
    setError("");
    setPending(action);
    try {
      // On success the queue re-renders without this card, so there is nothing to reset.
      const response = await onDecide(action, action === "approve" ? null : reasonCode);
      if (!response.success) setError(response.error);
    } catch (decisionError) {
      console.error("Review action failed", decisionError);
      setError("The decision could not be saved. Please try again.");
    } finally {
      setPending(null);
    }
  }

  function toggleReasons(action: Exclude<ReviewAction, "approve">) {
    setReasonFor((current) => (current === action ? null : action));
    setError("");
  }

  const busy = pending !== null;

  return (
    <div className="mt-5 border-t border-white/10 pt-5">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => decide("approve")} disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">
          {pending === "approve" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}{approveLabel}
        </button>
        <button type="button" onClick={() => toggleReasons("request_changes")} disabled={busy} aria-expanded={reasonFor === "request_changes"} className={secondaryButton}><Pencil size={14} />Request Changes</button>
        {allowReject && <button type="button" onClick={() => toggleReasons("reject")} disabled={busy} aria-expanded={reasonFor === "reject"} className={`${secondaryButton} hover:border-rose-300/40 hover:text-rose-200`}><X size={14} />Reject</button>}
      </div>

      {reasonFor && (
        <fieldset className="mt-4 rounded-xl border border-white/10 bg-slate-950/50 p-4">
          <legend className="px-1 text-xs font-medium text-slate-300">{reasonFor === "reject" ? "Reason for rejection" : "What needs to change?"}</legend>
          <div className="space-y-2">
            {Object.entries(REASON_CODES[target]).map(([code, label]) => (
              <label key={code} className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-400">
                <input type="radio" name={`reason-${target}`} value={code} checked={reasonCode === code} onChange={() => setReasonCode(code)} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-emerald-400" />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-600">The applicant will see the selected reason.</p>
          <button type="button" onClick={() => decide(reasonFor)} disabled={busy || !reasonCode} className={`mt-3 ${secondaryButton}`}>
            {pending === reasonFor && <Loader2 size={14} className="animate-spin" />}
            {reasonFor === "reject" ? "Confirm Rejection" : "Send Back for Changes"}
          </button>
        </fieldset>
      )}

      {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
