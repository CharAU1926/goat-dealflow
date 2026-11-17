"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2, Send } from "lucide-react";
import { submitInvestorVerification } from "@/app/actions/investor";
import { ConsentCheckbox } from "@/components/auth/auth-shell";
import EvidenceUpload from "@/components/evidence-upload";
import {
  INVESTOR_TYPES,
  INVESTOR_TYPE_CONFIG,
  INVESTOR_TYPE_LABELS,
  REGULATED_AUTHORITIES,
  type InvestorFormField,
  type InvestorFormState,
  type InvestorType,
} from "@/lib/investor-verification";

type InvestorVerificationFormProps = { userId: string; initialValues: InvestorFormState; reviewerNotes: string | null; wasRejected: boolean };
type FieldErrors = Partial<Record<InvestorFormField, string>>;

const inputClass = "min-h-11 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-400/60 aria-invalid:border-rose-400/60";
const labelClass = "mb-2 block text-xs font-medium text-slate-400";

export default function InvestorVerificationForm({ userId, initialValues, reviewerNotes, wasRejected }: InvestorVerificationFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const config = values.investorType ? INVESTOR_TYPE_CONFIG[values.investorType] : null;

  function update<Field extends InvestorFormField>(field: Field, value: InvestorFormState[Field]) {
    setValues((current) => ({ ...current, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config) {
      setFieldErrors({ investorType: "Select your investor type." });
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const response = await submitInvestorVerification(values);
      if (!response.success) {
        setError(response.error);
        setFieldErrors(response.fieldErrors ?? {});
        return;
      }
      router.refresh();
    } catch (submissionError) {
      console.error("Investor verification failed", submissionError);
      setError("We couldn't save your application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6">
      <h2 className="text-base font-semibold text-white">Verification details</h2>
      {reviewerNotes && (
        <div className={`mt-4 rounded-xl border p-4 text-sm leading-6 ${wasRejected ? "border-rose-300/25 bg-rose-300/5 text-rose-100" : "border-amber-300/25 bg-amber-300/5 text-amber-100"}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{wasRejected ? "Application not approved" : "Changes requested"}</p>
          <p className="mt-1">{reviewerNotes}</p>
        </div>
      )}

      <div className="mt-5 space-y-5">
        <div>
          <label htmlFor="investorType" className={labelClass}>Investor type</label>
          <select id="investorType" value={values.investorType} onChange={(event) => update("investorType", event.target.value as InvestorType | "")} className={inputClass} aria-invalid={Boolean(fieldErrors.investorType)}>
            <option value="" disabled className="bg-slate-900">Select your investor type</option>
            {INVESTOR_TYPES.map((type) => <option key={type} value={type} className="bg-slate-900">{INVESTOR_TYPE_LABELS[type]}</option>)}
          </select>
          <FieldError message={fieldErrors.investorType} />
        </div>

        {config && (
          <fieldset className="space-y-5 rounded-xl border border-white/10 bg-slate-950/40 p-4">
            <legend className="px-1 text-xs font-medium text-slate-300">Evidence</legend>
            <p className="text-xs leading-5 text-slate-500">{config.intro}</p>

            {config.firmLabel && (
              <div>
                <label htmlFor="firm" className={labelClass}>{config.firmLabel}</label>
                <input id="firm" value={values.firm} onChange={(event) => update("firm", event.target.value)} maxLength={200} placeholder={config.firmPlaceholder} className={inputClass} aria-invalid={Boolean(fieldErrors.firm)} />
                <FieldError message={fieldErrors.firm} />
              </div>
            )}

            {values.investorType === "vc" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="title" className={labelClass}>Your title at the fund</label>
                  <input id="title" value={values.title} onChange={(event) => update("title", event.target.value)} maxLength={200} placeholder="Partner, Principal, Associate" className={inputClass} aria-invalid={Boolean(fieldErrors.title)} />
                  <FieldError message={fieldErrors.title} />
                </div>
                <div>
                  <label htmlFor="regulatedAuthority" className={labelClass}>Regulated authority</label>
                  <select id="regulatedAuthority" value={values.regulatedAuthority} onChange={(event) => update("regulatedAuthority", event.target.value)} className={inputClass} aria-invalid={Boolean(fieldErrors.regulatedAuthority)}>
                    <option value="" disabled className="bg-slate-900">Select the fund&apos;s regulator</option>
                    {REGULATED_AUTHORITIES.map((authority) => <option key={authority} value={authority} className="bg-slate-900">{authority}</option>)}
                  </select>
                  <FieldError message={fieldErrors.regulatedAuthority} />
                </div>
              </div>
            )}

            {values.investorType === "angel" && (
              <div>
                <label htmlFor="capTableLinks" className={labelClass}>Cap table links</label>
                <textarea id="capTableLinks" value={values.capTableLinks} onChange={(event) => update("capTableLinks", event.target.value)} rows={3} maxLength={1500} placeholder="https:// (one link per line)" className={`${inputClass} resize-y py-3 leading-6`} aria-invalid={Boolean(fieldErrors.capTableLinks)} />
                <FieldError message={fieldErrors.capTableLinks} />
              </div>
            )}

            <EvidenceUpload userId={userId} purpose="investor" label={config.uploadLabel} optional={!config.uploadRequired} value={values.evidenceFilePath} error={fieldErrors.evidenceFilePath} onChange={(path) => update("evidenceFilePath", path)} onBusyChange={setIsUploading} />

            {values.investorType !== "student_fund" && (
              <ConsentCheckbox id="fundsStudentCompanies" checked={values.fundsStudentCompanies} onChange={(checked) => update("fundsStudentCompanies", checked)}>I am open to funding student-led companies that are not yet registered.</ConsentCheckbox>
            )}
          </fieldset>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        <button type="submit" disabled={!config || isSubmitting || isUploading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {isSubmitting ? "Submitting" : "Submit for Verification"}
        </button>
      </div>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-2 text-xs text-rose-300">{message}</p> : null;
}

export function StatusBanner({ tone, title, children }: { tone: "review" | "verified"; title: string; children?: React.ReactNode }) {
  const styles = tone === "verified" ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-300" : "border-amber-300/25 bg-amber-300/5 text-amber-200";
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-5 ${styles}`}>
      <CircleCheck size={18} className="mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        {children && <div className="mt-1 text-sm leading-6 text-slate-400">{children}</div>}
      </div>
    </div>
  );
}
