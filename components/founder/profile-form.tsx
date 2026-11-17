"use client";

import { useState } from "react";
import { Slider } from "@base-ui/react/slider";
import { Check, CircleCheck, Loader2, Plus, Send, X } from "lucide-react";
import { saveFounderProfile } from "@/app/actions/founder";
import { notifyMeaningfulAction } from "@/lib/pwa";
import {
  BIO_MIN_LENGTH,
  COMMITMENTS,
  COMMITMENT_LABELS,
  COMPANY_TYPES,
  COMPANY_TYPE_LABELS,
  ROLES_SOUGHT,
  SKILLS_MIN,
  SKILL_CATEGORIES,
  SKILL_TAXONOMY,
  getCompleteness,
  getCredentials,
  type FounderProfileField,
  type FounderProfileValues,
  type ProfileStatus,
} from "@/lib/founder-profile";

type FounderProfileFormProps = { initialValues: FounderProfileValues; initialStatus: ProfileStatus; email: string; emailVerified: boolean };

const statusBadges: Record<ProfileStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-white/10 text-slate-400" },
  pending_review: { label: "In Review", className: "border-amber-300/25 bg-amber-300/10 text-amber-200" },
  approved: { label: "Approved", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" },
  paused: { label: "Paused", className: "border-white/10 text-slate-400" },
};

const statusMessages: Record<ProfileStatus, string> = {
  draft: "Everything required is in place. You can submit for review.",
  pending_review: "In review. A GOAT operator will check your profile before it becomes visible. You can still update your details.",
  approved: "Approved and visible to members. Saving changes sends your profile back for review.",
  paused: "Your profile is paused and hidden. Submit for review to make it visible again.",
};
type FieldErrors = Partial<Record<FounderProfileField, string>>;

const inputClass = "min-h-11 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-400/60 aria-invalid:border-rose-400/60";
const languageSuggestions = ["English", "Greek", "Turkish", "Russian", "German", "French"];

export default function FounderProfileForm({ initialValues, initialStatus, email, emailVerified }: FounderProfileFormProps) {
  const [values, setValues] = useState(initialValues);
  const [status, setStatus] = useState(initialStatus);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<"draft" | "submit" | null>(null);
  const [languageDraft, setLanguageDraft] = useState("");

  const { percent, missing } = getCompleteness(values);
  const credentials = getCredentials(values, emailVerified);
  const inReview = status === "pending_review" || status === "approved";
  const canSubmit = percent === 100 && credentials.every((credential) => credential.done);

  function update<Field extends FounderProfileField>(field: Field, value: FounderProfileValues[Field]) {
    setValues((current) => ({ ...current, [field]: value }));
    setNotice("");
    if (fieldErrors[field]) setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function toggle<Field extends "skills" | "rolesSought">(field: Field, item: FounderProfileValues[Field][number]) {
    const selected = values[field] as string[];
    const next = selected.includes(item) ? selected.filter((value) => value !== item) : [...selected, item];
    update(field, next as FounderProfileValues[Field]);
  }

  function addLanguage(language: string) {
    const trimmed = language.trim();
    if (trimmed && !values.languages.some((value) => value.toLowerCase() === trimmed.toLowerCase())) update("languages", [...values.languages, trimmed]);
    setLanguageDraft("");
  }

  async function save(intent: "draft" | "submit") {
    setError("");
    setNotice("");
    setPending(intent);
    try {
      const response = await saveFounderProfile(values, intent);
      if (!response.success) {
        setError(response.error);
        setFieldErrors(response.fieldErrors ?? {});
        return;
      }
      setFieldErrors({});
      setStatus(response.status);
      setNotice(response.status === "pending_review" ? "Profile submitted. It is now in review." : "Draft saved.");
      if (intent === "submit") notifyMeaningfulAction(); // PRD v1.6 §7: offer install after a submission.
    } catch (submissionError) {
      console.error("Founder profile save failed", submissionError);
      setError("We couldn't save your profile. Please try again.");
    } finally {
      setPending(null);
    }
  }

  const unusedSuggestions = languageSuggestions.filter((language) => !values.languages.includes(language));

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
        <div role="progressbar" aria-label="Profile completeness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-300 ease-out" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {percent < 100 ? `Still needed: ${missing.join(", ")}.` : statusMessages[status]}
        </p>
      </section>

      <Card title="Verification credentials" description="All three are required before your profile can be submitted for review.">
        <ul className="space-y-3">
          {credentials.map((credential, index) => (
            <li key={credential.label} className="flex items-start gap-3 text-sm">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${credential.done ? "bg-emerald-400 text-slate-950" : "border border-white/15 text-slate-600"}`}>{credential.done ? <Check size={12} strokeWidth={3} /> : <span className="text-[10px]">{index + 1}</span>}</span>
              <span className={credential.done ? "text-slate-200" : "text-slate-500"}>
                {credential.label}
                {index === 0 && <span className="block text-xs text-slate-500">{email}</span>}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="About you">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="fullName" error={fieldErrors.fullName}>
            <input id="fullName" autoComplete="name" value={values.fullName} onChange={(event) => update("fullName", event.target.value)} maxLength={120} className={inputClass} aria-invalid={Boolean(fieldErrors.fullName)} />
          </Field>
          <Field label="City / location" htmlFor="location" error={fieldErrors.location}>
            <input id="location" value={values.location} onChange={(event) => update("location", event.target.value)} maxLength={120} className={inputClass} aria-invalid={Boolean(fieldErrors.location)} />
          </Field>
        </div>
        <Field label="Headline" htmlFor="headline" error={fieldErrors.headline}>
          <input id="headline" value={values.headline} onChange={(event) => update("headline", event.target.value)} maxLength={120} placeholder="Full-Stack Dev & AI Researcher" className={inputClass} aria-invalid={Boolean(fieldErrors.headline)} />
        </Field>
        <Field label="Bio" htmlFor="bio" error={fieldErrors.bio} hint={`${values.bio.trim().length} / ${BIO_MIN_LENGTH} characters minimum`}>
          <textarea id="bio" value={values.bio} onChange={(event) => update("bio", event.target.value)} maxLength={1500} rows={5} placeholder="What you have built, what you are looking for, and how you like to work." className={`${inputClass} resize-y py-3 leading-6`} aria-invalid={Boolean(fieldErrors.bio)} />
        </Field>
        <Field label="Languages" htmlFor="language" error={fieldErrors.languages}>
          <div className="flex flex-wrap gap-2">
            {values.languages.map((language) => (
              <span key={language} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 py-1 pl-2.5 pr-1.5 text-xs text-emerald-100">
                {language}
                <button type="button" onClick={() => update("languages", values.languages.filter((value) => value !== language))} aria-label={`Remove ${language}`} className="rounded p-0.5 text-emerald-200/70 transition-colors hover:text-white"><X size={12} /></button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input id="language" value={languageDraft} onChange={(event) => setLanguageDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addLanguage(languageDraft); } }} maxLength={40} placeholder="Add a language" className={inputClass} />
            <button type="button" onClick={() => addLanguage(languageDraft)} disabled={!languageDraft.trim()} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium text-slate-300 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus size={14} />Add</button>
          </div>
          {unusedSuggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {unusedSuggestions.map((language) => <button key={language} type="button" onClick={() => addLanguage(language)} className="rounded-md border border-dashed border-white/10 px-2.5 py-1 text-xs text-slate-500 transition-colors hover:border-white/25 hover:text-slate-300">+ {language}</button>)}
            </div>
          )}
        </Field>
      </Card>

      <Card title="Skills" description={`Select at least ${SKILLS_MIN} that describe what you bring.`}>
        {SKILL_CATEGORIES.map((category) => (
          <fieldset key={category}>
            <legend className="mb-2 text-xs font-medium text-slate-400">{category}</legend>
            <div className="flex flex-wrap gap-2">
              {SKILL_TAXONOMY[category].map((skill) => <Chip key={skill} selected={values.skills.includes(skill)} onClick={() => toggle("skills", skill)}>{skill}</Chip>)}
            </div>
          </fieldset>
        ))}
        {fieldErrors.skills && <p className="text-xs text-rose-300">{fieldErrors.skills}</p>}
      </Card>

      <Card title="What you are looking for">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-slate-400">Role(s) sought</legend>
          <div className="flex flex-wrap gap-2">
            {ROLES_SOUGHT.map((role) => <Chip key={role} selected={values.rolesSought.includes(role)} onClick={() => toggle("rolesSought", role)}>{role}</Chip>)}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-slate-400">Commitment</legend>
          <Segmented options={COMMITMENTS} labels={COMMITMENT_LABELS} value={values.commitment} onChange={(value) => update("commitment", value)} />
        </fieldset>
        <fieldset>
          <legend className="mb-2 flex w-full items-center justify-between text-xs font-medium text-slate-400">
            <span>Equity expectation</span>
            <span className="text-sm font-semibold text-white">{values.equityMax > 0 ? `${values.equityMin}% – ${values.equityMax}%` : <span className="font-normal text-slate-600">Drag to set a range</span>}</span>
          </legend>
          <Slider.Root value={[values.equityMin, values.equityMax]} onValueChange={(range) => { update("equityMin", range[0]); update("equityMax", range[1]); }} min={0} max={100} step={1}>
            <Slider.Control className="flex h-8 w-full touch-none items-center select-none">
              <Slider.Track className="h-1.5 w-full rounded-full bg-white/10">
                <Slider.Indicator className="rounded-full bg-emerald-400" />
                {(["Minimum equity", "Maximum equity"] as const).map((label, index) => <Slider.Thumb key={label} index={index} getAriaLabel={() => label} className="size-5 rounded-full border-2 border-emerald-400 bg-slate-950 shadow-md shadow-black/40 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-emerald-300" />)}
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-slate-600"><span>0%</span><span>100%</span></div>
          {fieldErrors.equityMax && <p className="mt-2 text-xs text-rose-300">{fieldErrors.equityMax}</p>}
        </fieldset>
      </Card>

      <Card title="Links">
        <Field label="LinkedIn URL" htmlFor="linkedinUrl" error={fieldErrors.linkedinUrl}>
          <input id="linkedinUrl" type="url" inputMode="url" value={values.linkedinUrl} onChange={(event) => update("linkedinUrl", event.target.value)} placeholder="https://www.linkedin.com/in/you" className={inputClass} aria-invalid={Boolean(fieldErrors.linkedinUrl)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GitHub URL" optional htmlFor="githubUrl" error={fieldErrors.githubUrl}>
            <input id="githubUrl" type="url" inputMode="url" value={values.githubUrl} onChange={(event) => update("githubUrl", event.target.value)} placeholder="https://github.com/you" className={inputClass} aria-invalid={Boolean(fieldErrors.githubUrl)} />
          </Field>
          <Field label="Portfolio" optional htmlFor="portfolioUrl" error={fieldErrors.portfolioUrl}>
            <input id="portfolioUrl" type="url" inputMode="url" value={values.portfolioUrl} onChange={(event) => update("portfolioUrl", event.target.value)} placeholder="https://your-site.com" className={inputClass} aria-invalid={Boolean(fieldErrors.portfolioUrl)} />
          </Field>
        </div>
      </Card>

      <Card title="Company type" description="Tell us whether this is a student project or an incorporated company.">
        <Segmented options={COMPANY_TYPES} labels={COMPANY_TYPE_LABELS} value={values.companyType} onChange={(value) => update("companyType", value)} />
      </Card>

      <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          {!inReview && (
            <button type="button" onClick={() => save("draft")} disabled={pending !== null} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/10 px-5 text-sm font-medium text-slate-200 transition-colors hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
              {pending === "draft" && <Loader2 size={16} className="animate-spin" />}
              {pending === "draft" ? "Saving" : "Save Draft"}
            </button>
          )}
          <button type="button" onClick={() => save("submit")} disabled={!canSubmit || pending !== null} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">
            {pending === "submit" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {pending === "submit" ? "Submitting" : inReview ? "Update & Resubmit" : "Submit for Review"}
          </button>
        </div>
        {error && <p role="alert" className="mt-3 text-xs text-rose-300 sm:text-right">{error}</p>}
        {notice && <p role="status" className="mt-3 flex items-center gap-2 text-xs text-emerald-300 sm:justify-end"><CircleCheck size={14} />{notice}</p>}
        {!canSubmit && !error && <p className="mt-3 text-xs text-slate-600 sm:text-right">Submit for Review unlocks once your profile reaches 100%.</p>}
        <p className="mt-3 text-xs text-slate-600 sm:text-right">Your profile is not visible to other members until a GOAT operator approves it.</p>
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

function Field({ label, htmlFor, optional, hint, error, children }: { label: string; htmlFor: string; optional?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-xs font-medium text-slate-400">{label}{optional && <span className="ml-1.5 font-normal text-slate-600">Optional</span>}</label>
      {children}
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : hint ? <p className="mt-2 text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${selected ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100" : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"}`}>
      {selected && <Check size={12} strokeWidth={3} />}
      {children}
    </button>
  );
}

function Segmented<Option extends string>({ options, labels, value, onChange }: { options: readonly Option[]; labels: Record<Option, string>; value: Option | null; onChange: (value: Option) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-slate-950/60 p-1">
      {options.map((option) => <button key={option} type="button" onClick={() => onChange(option)} aria-pressed={value === option} className={`rounded-md px-3 py-2.5 text-xs font-medium transition-colors ${value === option ? "bg-slate-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>{labels[option]}</button>)}
    </div>
  );
}
