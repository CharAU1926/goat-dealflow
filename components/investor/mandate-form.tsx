"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2, Save } from "lucide-react";
import { saveMandate } from "@/app/actions/mandate";
import {
  MANDATE_COMPANY_TYPES,
  MANDATE_COMPANY_TYPE_LABELS,
  MANDATE_GEOGRAPHIES,
  MANDATE_GEOGRAPHY_LABELS,
  MANDATE_SECTORS,
  MANDATE_STAGES,
  MANDATE_STAGE_LABELS,
  type MandateFormField,
  type MandateFormState,
} from "@/lib/mandate";

type FieldErrors = Partial<Record<MandateFormField, string>>;

const inputClass = "min-h-11 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-400/60 aria-invalid:border-rose-400/60";
const labelClass = "mb-2 block text-xs font-medium text-slate-400";

export default function MandateForm({ initialValues, fundsStudentCompanies }: { initialValues: MandateFormState; fundsStudentCompanies: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update<Field extends MandateFormField>(field: Field, value: MandateFormState[Field]) {
    setValues((current) => ({ ...current, [field]: value }));
    setSaved(false);
    if (fieldErrors[field]) setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  const toggle = (field: "sectors" | "stages" | "geographies", option: string) =>
    update(field, values[field].includes(option) ? values[field].filter((item) => item !== option) : [...values[field], option]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setIsSubmitting(true);
    try {
      const response = await saveMandate(values);
      if (!response.success) {
        setError(response.error);
        setFieldErrors(response.fieldErrors ?? {});
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (submissionError) {
      console.error("Mandate save failed", submissionError);
      setError("We couldn't save your mandate. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Section title="Sectors" hint="Leave empty to see every sector.">
        <ChipGroup legend="Sectors" options={MANDATE_SECTORS.map((value) => ({ value, label: value }))} selected={values.sectors} onToggle={(value) => toggle("sectors", value)} />
      </Section>

      <div className="grid gap-5 md:grid-cols-2">
        <Section title="Stages">
          <ChipGroup legend="Stages" options={MANDATE_STAGES.map((value) => ({ value, label: MANDATE_STAGE_LABELS[value] }))} selected={values.stages} onToggle={(value) => toggle("stages", value)} />
        </Section>
        <Section title="Geography">
          <ChipGroup legend="Geography" options={MANDATE_GEOGRAPHIES.map((value) => ({ value, label: MANDATE_GEOGRAPHY_LABELS[value] }))} selected={values.geographies} onToggle={(value) => toggle("geographies", value)} />
        </Section>
      </div>

      <Section title="Cheque range" hint="Per-company investment size, in EUR.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="chequeMin" className={labelClass}>Cheque min (€)</label>
            <input id="chequeMin" inputMode="numeric" value={values.chequeMin} onChange={(event) => update("chequeMin", event.target.value.replace(/\D/g, ""))} maxLength={10} placeholder="25000" className={inputClass} aria-invalid={Boolean(fieldErrors.chequeMin)} />
            <FieldError message={fieldErrors.chequeMin} />
          </div>
          <div>
            <label htmlFor="chequeMax" className={labelClass}>Cheque max (€)</label>
            <input id="chequeMax" inputMode="numeric" value={values.chequeMax} onChange={(event) => update("chequeMax", event.target.value.replace(/\D/g, ""))} maxLength={10} placeholder="250000" className={inputClass} aria-invalid={Boolean(fieldErrors.chequeMax)} />
            <FieldError message={fieldErrors.chequeMax} />
          </div>
        </div>
      </Section>

      <Section title="Company type" hint={fundsStudentCompanies ? "Student companies are included by default because you fund them." : "Registered companies only. To include student companies, say that you fund them in your verification details."}>
        <fieldset>
          <legend className="sr-only">Company type</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {MANDATE_COMPANY_TYPES.map((type) => {
              const disabled = type === "include_student" && !fundsStudentCompanies;
              const active = values.companyType === type;
              return (
                <label key={type} className={`flex min-h-12 items-center gap-3 rounded-lg border px-4 text-sm transition-colors ${disabled ? "cursor-not-allowed border-white/5 text-slate-600" : active ? "cursor-pointer border-emerald-400/50 bg-emerald-400/8 text-white" : "cursor-pointer border-white/10 text-slate-300 hover:border-white/20"}`}>
                  <input type="radio" name="companyType" value={type} checked={active} disabled={disabled} onChange={() => update("companyType", type)} className="h-4 w-4 accent-emerald-400" />
                  {MANDATE_COMPANY_TYPE_LABELS[type]}
                </label>
              );
            })}
          </div>
          <FieldError message={fieldErrors.companyType} />
        </fieldset>
      </Section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        {saved && <p role="status" className="flex items-center gap-2 text-xs text-emerald-300"><CircleCheck size={14} />Mandate saved</p>}
        <button type="submit" disabled={isSubmitting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isSubmitting ? "Saving" : "Save Mandate"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {hint && <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ChipGroup({ legend, options, selected, onToggle }: { legend: string; options: { value: string; label: string }[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button key={option.value} type="button" role="checkbox" aria-checked={active} onClick={() => onToggle(option.value)} className={`min-h-10 rounded-lg border px-3.5 text-sm transition-colors ${active ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200" : "border-white/10 text-slate-300 hover:border-white/20"}`}>
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-2 text-xs text-rose-300">{message}</p> : null;
}
