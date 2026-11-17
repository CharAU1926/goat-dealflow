"use client";

import { useState } from "react";
import { Check, Loader2, Save, Send } from "lucide-react";
import { saveStartupProfile } from "@/app/actions/startup";
import { notifyMeaningfulAction } from "@/lib/pwa";
import { ConsentCheckbox } from "@/components/auth/auth-shell";
import EvidenceUpload from "@/components/evidence-upload";
import { COMPANY_TYPES } from "@/lib/founder-profile";
import {
  ACTIVE_RAISE_CONFIRMATION,
  COMPANY_TYPE_OPTIONS,
  DESCRIPTION_MIN_LENGTH,
  SAFE_CLAIMS_DECLARATION,
  SECTORS,
  SECTORS_MAX,
  STAGE_LABELS,
  STARTUP_EVIDENCE,
  STARTUP_STAGES,
  getStartupCompleteness,
  type StartupProfileField,
  type StartupProfileValues,
  type StartupStage,
} from "@/lib/startups";

type Status = "draft" | "pending_review" | "rejected";
type StartupProfileFormProps = { userId: string; initialValues: StartupProfileValues; initialStatus: Status; reviewerNotes: string | null };
type FieldErrors = Partial<Record<StartupProfileField, string>>;
type TextField = "name" | "oneLiner" | "city" | "country" | "fundingSought" | "tractionSignal" | "websiteUrl" | "pitchDeckUrl" | "registrationNumber";
type AreaField = "description" | "useOfFunds";

const inputClass = "min-h-11 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-400/60 aria-invalid:border-rose-400/60";
const labelClass = "mb-2 block text-xs font-medium text-slate-400";
const statusBadges: Record<Status, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-white/15 text-slate-400" },
  rejected: { label: "Changes needed", className: "border-rose-300/30 text-rose-200" },
  pending_review: { label: "In review", className: "border-amber-300/30 text-amber-200" },
};

export default function StartupProfileForm({ userId, initialValues, initialStatus, reviewerNotes }: StartupProfileFormProps) {
  const [values, setValues] = useState(initialValues);
  const [status, setStatus] = useState(initialStatus);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<"draft" | "submit" | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { percent, missing } = getStartupCompleteness(values);
  const inReview = status === "pending_review";
  const declared = values.safeClaimsDeclared && values.activeRaiseConfirmed;
  const canSubmit = percent === 100 && declared && !pending && !isUploading;
  const evidence = values.companyType ? STARTUP_EVIDENCE[values.companyType] : null;

  function update<Field extends StartupProfileField>(field: Field, value: StartupProfileValues[Field]) {
    setValues((current) => ({ ...current, [field]: value }));
    setNotice("");
    if (fieldErrors[field]) setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function toggleSector(sector: string) {
    const selected = values.sectors.includes(sector);
    if (!selected && values.sectors.length >= SECTORS_MAX) return;
    update("sectors", selected ? values.sectors.filter((value) => value !== sector) : [...values.sectors, sector]);
  }

  // A different company type needs a different document, so the previous upload is dropped.
  function chooseCompanyType(companyType: StartupProfileValues["companyType"]) {
    if (companyType === values.companyType) return;
    setValues((current) => ({ ...current, companyType, evidenceFilePath: "" }));
    setFieldErrors((current) => ({ ...current, companyType: undefined, evidenceFilePath: undefined, registrationNumber: undefined }));
  }

  async function save(intent: "draft" | "submit") {
    setError("");
    setNotice("");
    setPending(intent);
    try {
      const response = await saveStartupProfile(values, intent);
      if (!response.success) {
        setError(response.error);
        setFieldErrors(response.fieldErrors ?? {});
        return;
      }
      setFieldErrors({});
      setStatus(response.status);
      setNotice(response.status === "pending_review" ? "Submitted. Your startup is now in the operator review queue." : "Draft saved.");
      if (intent === "submit") notifyMeaningfulAction(); // PRD v1.6 §7: offer install after a submission.
    } catch (saveError) {
      console.error("Startup profile save failed", saveError);
      setError("We couldn't save your startup. Please try again.");
    } finally {
      setPending(null);
    }
  }

  const textField = (name: TextField, label: string, options: { placeholder?: string; maxLength?: number; inputMode?: "numeric" | "url"; hint?: string } = {}) => (
    <div>
      <label htmlFor={name} className={labelClass}>{label}</label>
      <input id={name} value={values[name]} onChange={(event) => update(name, event.target.value)} maxLength={options.maxLength ?? 160} inputMode={options.inputMode} placeholder={options.placeholder} className={inputClass} aria-invalid={Boolean(fieldErrors[name])} />
      {fieldErrors[name] ? <p className="mt-2 text-xs text-rose-300">{fieldErrors[name]}</p> : options.hint ? <p className="mt-2 text-xs text-slate-600">{options.hint}</p> : null}
    </div>
  );

  const areaField = (name: AreaField, label: string, options: { placeholder: string; maxLength: number; rows: number; hint?: string }) => (
    <div>
      <label htmlFor={name} className={labelClass}>{label}</label>
      <textarea id={name} value={values[name]} onChange={(event) => update(name, event.target.value)} maxLength={options.maxLength} rows={options.rows} placeholder={options.placeholder} className={`${inputClass} resize-y py-3 leading-6`} aria-invalid={Boolean(fieldErrors[name])} />
      {fieldErrors[name] ? <p className="mt-2 text-xs text-rose-300">{fieldErrors[name]}</p> : options.hint ? <p className="mt-2 text-xs text-slate-600">{options.hint}</p> : null}
    </div>
  );

  return (
    <form onSubmit={(event) => event.preventDefault()} noValidate className="space-y-5">
      <section className="sticky top-3 z-20 rounded-2xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Profile completeness
            <span className={`rounded-md border px-2 py-0.5 text-[10px] tracking-wider ${statusBadges[status].className}`}>{statusBadges[status].label}</span>
          </p>
          <p className="text-sm font-semibold text-white"><span className={percent === 100 ? "text-emerald-300" : undefined}>{percent}%</span></p>
        </div>
        <div role="progressbar" aria-label="Startup profile completeness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-300 ease-out" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {percent < 100 ? `Still needed: ${missing.join(", ")}.` : inReview ? "In the operator review queue. Saving changes keeps it in review." : "Every required field is complete. Accept the declarations to submit for review."}
        </p>
      </section>

      {reviewerNotes && status !== "pending_review" && (
        <div className={`rounded-2xl border p-5 text-sm leading-6 ${status === "rejected" ? "border-rose-300/25 bg-rose-300/5 text-rose-100" : "border-amber-300/25 bg-amber-300/5 text-amber-100"}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{status === "rejected" ? "Submission not approved" : "Changes requested by the GOAT team"}</p>
          <p className="mt-1">{reviewerNotes}</p>
        </div>
      )}

      <Card title="Your startup" description="This is what investors see on your deal card. Revenue and other financial metrics are never shown publicly.">
        {textField("name", "Startup name", { maxLength: 120 })}
        <div>
          {textField("oneLiner", "One-liner", { maxLength: 140, placeholder: "Autonomous logistics for short-sea shipping", hint: `${values.oneLiner.trim().length} / 140 characters` })}
        </div>
        {areaField("description", "Description, problem and solution", { maxLength: 3000, rows: 7, placeholder: "What problem do you solve, for whom, and how does your product solve it?", hint: `${values.description.trim().length} / ${DESCRIPTION_MIN_LENGTH} characters minimum` })}
        <fieldset>
          <legend className={labelClass}>Sector (up to {SECTORS_MAX})</legend>
          <div className="flex flex-wrap gap-2">
            {SECTORS.map((sector) => {
              const selected = values.sectors.includes(sector);
              return <button key={sector} type="button" onClick={() => toggleSector(sector)} aria-pressed={selected} className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${selected ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100" : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"}`}>{selected && <Check size={12} strokeWidth={3} />}{sector}</button>;
            })}
          </div>
          {fieldErrors.sectors && <p className="mt-2 text-xs text-rose-300">{fieldErrors.sectors}</p>}
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label htmlFor="stage" className={labelClass}>Stage</label>
            <select id="stage" value={values.stage} onChange={(event) => update("stage", event.target.value as StartupStage)} className={inputClass}>
              {STARTUP_STAGES.map((stage) => <option key={stage} value={stage} className="bg-slate-900">{STAGE_LABELS[stage]}</option>)}
            </select>
          </div>
          {textField("city", "City", { maxLength: 80, placeholder: "Limassol" })}
          {textField("country", "Country", { maxLength: 80 })}
        </div>
      </Card>

      <Card title="Raise and traction" description="The traction signal is shown publicly, so keep it non-financial.">
        <div className="grid gap-5 sm:grid-cols-2">
          {textField("fundingSought", "Funding target (€)", { maxLength: 9, inputMode: "numeric", placeholder: "350000" })}
          {textField("tractionSignal", "Traction signal", { maxLength: 60, placeholder: "12 pilots active", hint: "No currency symbols or revenue figures." })}
        </div>
        {areaField("useOfFunds", "Use of funds", { maxLength: 1000, rows: 4, placeholder: "How will this round be spent over the next 12–18 months?" })}
        <div className="grid gap-5 sm:grid-cols-2">
          {textField("websiteUrl", "Website (optional)", { maxLength: 300, inputMode: "url", placeholder: "https://example.com" })}
          {textField("pitchDeckUrl", "Pitch deck link (optional)", { maxLength: 300, inputMode: "url", placeholder: "https://example.com/deck.pdf", hint: "A link to a PDF. Only verified investors see it." })}
        </div>
      </Card>

      <Card title="Company type" description="Student ventures are shown to student funds; registered companies can be shown to all verified investors.">
        <div role="radiogroup" aria-label="Company type" className="grid gap-2 sm:grid-cols-2">
          {COMPANY_TYPES.map((companyType) => {
            const selected = values.companyType === companyType;
            return (
              <button key={companyType} type="button" role="radio" aria-checked={selected} onClick={() => chooseCompanyType(companyType)} className={`flex items-center gap-3 rounded-xl border p-4 text-left text-sm font-medium transition-colors ${selected ? "border-emerald-400/40 bg-emerald-400/10 text-white" : "border-white/10 bg-slate-950/60 text-slate-400 hover:border-white/20 hover:text-slate-200"}`}>
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? "border-emerald-400" : "border-white/25"}`}>{selected && <span className="h-2 w-2 rounded-full bg-emerald-400" />}</span>
                {COMPANY_TYPE_OPTIONS[companyType]}
              </button>
            );
          })}
        </div>
        {fieldErrors.companyType && <p className="text-xs text-rose-300">{fieldErrors.companyType}</p>}

        {values.companyType === "registered" && textField("registrationNumber", "Registration number (HE number)", { maxLength: 60, placeholder: "HE 123456" })}

        {evidence && (
          <EvidenceUpload key={values.companyType} userId={userId} purpose="startup" label={evidence.label} hint={evidence.hint} pdfOnly={evidence.pdfOnly} value={values.evidenceFilePath} error={fieldErrors.evidenceFilePath} onChange={(path) => update("evidenceFilePath", path)} onBusyChange={setIsUploading} />
        )}
      </Card>

      <Card title="Declarations" description="Required each time you submit.">
        <ConsentCheckbox id="safeClaimsDeclared" checked={values.safeClaimsDeclared} onChange={(checked) => update("safeClaimsDeclared", checked)}>{SAFE_CLAIMS_DECLARATION}</ConsentCheckbox>
        {fieldErrors.safeClaimsDeclared && <p className="text-xs text-rose-300">{fieldErrors.safeClaimsDeclared}</p>}
        <ConsentCheckbox id="activeRaiseConfirmed" checked={values.activeRaiseConfirmed} onChange={(checked) => update("activeRaiseConfirmed", checked)}>{ACTIVE_RAISE_CONFIRMATION}</ConsentCheckbox>
        {fieldErrors.activeRaiseConfirmed && <p className="text-xs text-rose-300">{fieldErrors.activeRaiseConfirmed}</p>}
      </Card>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-end">
        {error && <p role="alert" className="text-xs text-rose-300 sm:mr-auto">{error}</p>}
        {!error && notice && <p role="status" className="text-xs text-emerald-300 sm:mr-auto">{notice}</p>}
        {!inReview && (
          <button type="button" onClick={() => save("draft")} disabled={pending !== null || isUploading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/15 px-5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-40">
            {pending === "draft" ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Draft
          </button>
        )}
        <button type="button" onClick={() => save("submit")} disabled={!canSubmit} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">
          {pending === "submit" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {inReview ? "Save Changes" : "Submit for Review"}
        </button>
      </div>
    </form>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}
