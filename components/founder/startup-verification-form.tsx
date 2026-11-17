"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Send } from "lucide-react";
import { submitStartupVerification } from "@/app/actions/startup";
import { ConsentCheckbox } from "@/components/auth/auth-shell";
import EvidenceUpload from "@/components/evidence-upload";
import { COMPANY_TYPES } from "@/lib/founder-profile";
import {
  ACTIVE_RAISE_CONFIRMATION,
  COMPANY_TYPE_OPTIONS,
  SAFE_CLAIMS_DECLARATION,
  SECTORS,
  SECTORS_MAX,
  STAGE_LABELS,
  STARTUP_EVIDENCE,
  STARTUP_STAGES,
  type StartupFormField,
  type StartupFormState,
  type StartupStage,
} from "@/lib/startups";

type StartupVerificationFormProps = { userId: string; initialValues: StartupFormState; reviewerNotes: string | null; wasRejected: boolean };
type FieldErrors = Partial<Record<StartupFormField, string>>;
type TextField = "name" | "oneLiner" | "location" | "fundingSought" | "tractionSignal" | "legalName" | "registrationNumber" | "registrationCountry";

const inputClass = "min-h-11 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-400/60 aria-invalid:border-rose-400/60";
const labelClass = "mb-2 block text-xs font-medium text-slate-400";

export default function StartupVerificationForm({ userId, initialValues, reviewerNotes, wasRejected }: StartupVerificationFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const evidence = values.companyType ? STARTUP_EVIDENCE[values.companyType] : null;
  const canSubmit = values.safeClaimsDeclared && values.activeRaiseConfirmed && !isSubmitting && !isUploading;

  function update<Field extends StartupFormField>(field: Field, value: StartupFormState[Field]) {
    setValues((current) => ({ ...current, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function toggleSector(sector: string) {
    const selected = values.sectors.includes(sector);
    if (!selected && values.sectors.length >= SECTORS_MAX) return;
    update("sectors", selected ? values.sectors.filter((value) => value !== sector) : [...values.sectors, sector]);
  }

  // A different company type needs a different document, so the previous upload is dropped.
  function chooseCompanyType(companyType: StartupFormState["companyType"]) {
    if (companyType === values.companyType) return;
    setValues((current) => ({ ...current, companyType, evidenceFilePath: "" }));
    setFieldErrors((current) => ({ ...current, companyType: undefined, evidenceFilePath: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await submitStartupVerification(values);
      if (!response.success) {
        setError(response.error);
        setFieldErrors(response.fieldErrors ?? {});
        return;
      }
      router.refresh();
    } catch (submissionError) {
      console.error("Startup verification failed", submissionError);
      setError("We couldn't save your submission. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const textField = (name: TextField, label: string, options: { placeholder?: string; maxLength?: number; inputMode?: "numeric"; hint?: string } = {}) => (
    <div>
      <label htmlFor={name} className={labelClass}>{label}</label>
      <input id={name} value={values[name]} onChange={(event) => update(name, event.target.value)} maxLength={options.maxLength ?? 160} inputMode={options.inputMode} placeholder={options.placeholder} className={inputClass} aria-invalid={Boolean(fieldErrors[name])} />
      {fieldErrors[name] ? <p className="mt-2 text-xs text-rose-300">{fieldErrors[name]}</p> : options.hint ? <p className="mt-2 text-xs text-slate-600">{options.hint}</p> : null}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {reviewerNotes && (
        <div className={`rounded-2xl border p-5 text-sm leading-6 ${wasRejected ? "border-rose-300/25 bg-rose-300/5 text-rose-100" : "border-amber-300/25 bg-amber-300/5 text-amber-100"}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{wasRejected ? "Submission not approved" : "Changes requested by the GOAT team"}</p>
          <p className="mt-1">{reviewerNotes}</p>
        </div>
      )}

      <Card title="Your startup" description="This is what investors see on your deal card. Revenue and other financial metrics are never shown publicly.">
        <div className="grid gap-5 sm:grid-cols-2">
          {textField("name", "Startup name", { maxLength: 120 })}
          {textField("location", "Location", { maxLength: 120 })}
        </div>
        {textField("oneLiner", "One-liner", { maxLength: 140, placeholder: "Autonomous logistics for short-sea shipping" })}
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
          {textField("fundingSought", "Funding target (€)", { maxLength: 9, inputMode: "numeric", placeholder: "350000" })}
          {textField("tractionSignal", "Traction signal", { maxLength: 60, placeholder: "12 pilots active", hint: "Non-financial only." })}
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

        {values.companyType === "registered" && (
          <>
            {textField("legalName", "Legal name", { placeholder: "Company Ltd" })}
            <div className="grid gap-5 sm:grid-cols-2">
              {textField("registrationNumber", "Registration number (HE number)", { placeholder: "HE 123456" })}
              {textField("registrationCountry", "Country of registration")}
            </div>
          </>
        )}

        {evidence && (
          <EvidenceUpload key={values.companyType} userId={userId} purpose="startup" label={evidence.label} hint={evidence.hint} pdfOnly={evidence.pdfOnly} value={values.evidenceFilePath} error={fieldErrors.evidenceFilePath} onChange={(path) => update("evidenceFilePath", path)} onBusyChange={setIsUploading} />
        )}
      </Card>

      <Card title="Declarations">
        <ConsentCheckbox id="safeClaimsDeclared" checked={values.safeClaimsDeclared} onChange={(checked) => update("safeClaimsDeclared", checked)}>{SAFE_CLAIMS_DECLARATION}</ConsentCheckbox>
        {fieldErrors.safeClaimsDeclared && <p className="text-xs text-rose-300">{fieldErrors.safeClaimsDeclared}</p>}
        <ConsentCheckbox id="activeRaiseConfirmed" checked={values.activeRaiseConfirmed} onChange={(checked) => update("activeRaiseConfirmed", checked)}>{ACTIVE_RAISE_CONFIRMATION}</ConsentCheckbox>
        {fieldErrors.activeRaiseConfirmed && <p className="text-xs text-rose-300">{fieldErrors.activeRaiseConfirmed}</p>}
      </Card>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-end">
        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        {!error && !canSubmit && !isSubmitting && <p className="text-xs text-slate-600">Accept both declarations to submit.</p>}
        <button type="submit" disabled={!canSubmit} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {isSubmitting ? "Submitting" : "Submit for Review"}
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
