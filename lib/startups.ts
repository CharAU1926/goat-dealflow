import { z } from "zod";
import { COMPANY_TYPES, type CompanyType } from "@/lib/founder-profile";
import { isEvidencePath, type VerificationStatus } from "@/lib/investor-verification";

export const STARTUP_STAGES = ["idea", "pre_seed", "seed", "series_a"] as const;
export type StartupStage = (typeof STARTUP_STAGES)[number];
export const STAGE_LABELS: Record<StartupStage, string> = { idea: "Idea", pre_seed: "Pre-Seed", seed: "Seed", series_a: "Series A" };
export const stageLabel = (stage: string | null) => (stage && stage in STAGE_LABELS ? STAGE_LABELS[stage as StartupStage] : "Early stage");

export const SECTORS = ["AI / ML", "Fintech", "Healthtech", "Maritime", "Climate / Energy", "SaaS", "Supply Chain / IoT", "Edtech", "Consumer", "Deeptech", "Tourism", "Other"] as const;
export const SECTORS_MAX = 3;

// DK-2 Tier 0: the only startup fields anonymous visitors and unverified investors ever receive.
// These are exactly the columns of the `startup_teasers` database view.
export type StartupTeaser = {
  id: string;
  name: string;
  one_liner: string;
  sectors: string[] | null;
  stage: string | null;
  location: string | null;
  funding_sought: number | null;
  traction_signal: string | null;
};
export const TEASER_COLUMNS = "id, name, one_liner, sectors, stage, location, funding_sought, traction_signal";
export const DECK_SIZE = 3;

export function formatFunding(amount: number | null) {
  if (!amount || amount <= 0) return "Undisclosed";
  if (amount >= 1_000_000) return `€${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  if (amount >= 1_000) return `€${Math.round(amount / 1_000)}k`;
  return `€${amount}`;
}

/** Campaign slugs come from the URL, so they are restricted before being stored or shown. */
export function normalizeCampaign(value: string | null | undefined) {
  return value && /^[a-z0-9][a-z0-9-]{0,39}$/.test(value) ? value : null;
}

export const SAFE_CLAIMS_DECLARATION = "I declare that every claim in this submission is accurate and can be evidenced, and that it contains no guarantees of returns or forward-looking financial promises.";
export const ACTIVE_RAISE_CONFIRMATION = "I confirm that this company is actively raising, or intends to open a round within the next six months.";

export const STARTUP_EVIDENCE: Record<CompanyType, { evidenceType: string; label: string; hint: string; pdfOnly: boolean }> = {
  student: { evidenceType: "student_proof", label: "Student ID or University / JA Incubator letter", hint: "PDF, PNG or JPG, up to 10 MB.", pdfOnly: false },
  registered: { evidenceType: "registry_extract", label: "Registry Extract", hint: "PDF only, up to 10 MB.", pdfOnly: true },
};

export const COMPANY_TYPE_OPTIONS: Record<CompanyType, string> = { student: "Unregistered Student Venture", registered: "Registered Company" };

export type StartupFormState = {
  name: string;
  oneLiner: string;
  sectors: string[];
  stage: StartupStage;
  location: string;
  fundingSought: string;
  tractionSignal: string;
  companyType: CompanyType | null;
  legalName: string;
  registrationNumber: string;
  registrationCountry: string;
  evidenceFilePath: string;
  safeClaimsDeclared: boolean;
  activeRaiseConfirmed: boolean;
};
export type StartupFormField = keyof StartupFormState;

export const emptyStartupForm: StartupFormState = {
  name: "",
  oneLiner: "",
  sectors: [],
  stage: "idea",
  location: "Cyprus",
  fundingSought: "",
  tractionSignal: "",
  companyType: null,
  legalName: "",
  registrationNumber: "",
  registrationCountry: "Cyprus",
  evidenceFilePath: "",
  safeClaimsDeclared: false,
  activeRaiseConfirmed: false,
};

const text = (label: string, min: number, max: number) => z.string().trim().min(min, `${label} is required.`).max(max, `Keep this under ${max} characters.`);
const optionalText = z.string().trim().max(160, "Keep this under 160 characters.");

export const startupVerificationSchema = z
  .object({
    name: text("Startup name", 2, 120),
    oneLiner: z.string().trim().min(10, "Describe the startup in at least 10 characters.").max(140, "Keep the one-liner under 140 characters."),
    sectors: z.array(z.enum(SECTORS)).min(1, "Select at least one sector.").max(SECTORS_MAX, `Select up to ${SECTORS_MAX} sectors.`),
    stage: z.enum(STARTUP_STAGES),
    location: text("Location", 2, 120),
    fundingSought: z.string().trim().regex(/^\d{1,9}$/, "Enter the funding target as a whole number of euros.").refine((value) => Number(value) > 0, "Enter a funding target above zero."),
    // The traction signal is shown to anonymous visitors, so it must stay non-financial (DK-2).
    tractionSignal: text("Traction signal", 3, 60).refine((value) => !/[€$£]|\b(mrr|arr|revenue|burn|runway)\b/i.test(value), "Use a non-financial signal, e.g. “12 pilots active”. Revenue figures are only shared with verified investors."),
    companyType: z.enum(COMPANY_TYPES, "Select your company type."),
    legalName: optionalText,
    registrationNumber: optionalText,
    registrationCountry: optionalText,
    evidenceFilePath: z.string().refine((value) => isEvidencePath(value), "Upload the required document."),
    safeClaimsDeclared: z.literal(true, "Please accept the safe claims declaration."),
    activeRaiseConfirmed: z.literal(true, "Please confirm the raise status."),
  })
  .superRefine((values, context) => {
    if (values.companyType !== "registered") return;
    const need = (field: "legalName" | "registrationNumber" | "registrationCountry", message: string) => {
      if (!values[field]) context.addIssue({ code: "custom", path: [field], message });
    };
    need("legalName", "Legal name is required.");
    need("registrationNumber", "Registration number is required.");
    need("registrationCountry", "Country of registration is required.");
    if (!values.evidenceFilePath.endsWith(".pdf")) context.addIssue({ code: "custom", path: ["evidenceFilePath"], message: "The registry extract must be a PDF." });
  });

export type StartupRow = {
  id: string;
  owner_user_id: string;
  name: string;
  one_liner: string;
  sectors: string[] | null;
  stage: string | null;
  location: string | null;
  company_type: CompanyType | null;
  funding_sought: number | null;
  traction_signal: string | null;
  legal_name: string | null;
  registration_number: string | null;
  registration_country: string | null;
  evidence_type: string | null;
  evidence_file_path: string | null;
  safe_claims_declared_at: string | null;
  active_raise_confirmed_at: string | null;
  verification_status: VerificationStatus;
  reviewer_notes: string | null;
  submitted_at: string | null;
};
export const STARTUP_COLUMNS = "id, owner_user_id, name, one_liner, sectors, stage, location, company_type, funding_sought, traction_signal, legal_name, registration_number, registration_country, evidence_type, evidence_file_path, safe_claims_declared_at, active_raise_confirmed_at, verification_status, reviewer_notes, submitted_at";

export function rowToStartupForm(row: StartupRow): StartupFormState {
  return {
    name: row.name,
    oneLiner: row.one_liner,
    sectors: row.sectors ?? [],
    stage: (STARTUP_STAGES as readonly string[]).includes(row.stage ?? "") ? (row.stage as StartupStage) : "idea",
    location: row.location ?? "",
    fundingSought: row.funding_sought ? String(Math.round(row.funding_sought)) : "",
    tractionSignal: row.traction_signal ?? "",
    companyType: row.company_type,
    legalName: row.legal_name ?? "",
    registrationNumber: row.registration_number ?? "",
    registrationCountry: row.registration_country ?? "Cyprus",
    evidenceFilePath: row.evidence_file_path ?? "",
    // Declarations are re-confirmed on every submission rather than pre-ticked.
    safeClaimsDeclared: false,
    activeRaiseConfirmed: false,
  };
}
