import { z } from "zod";
import { isHttpUrl } from "@/lib/founder-profile";

// Values mirror the check constraints on `public.investor_profiles`.
export const INVESTOR_TYPES = ["angel", "vc", "general", "student_fund"] as const;
export type InvestorType = (typeof INVESTOR_TYPES)[number];

export const INVESTOR_TYPE_LABELS: Record<InvestorType, string> = {
  angel: "Individual Angel",
  vc: "VC / Fund Professional",
  general: "General Investor (HNWI)",
  student_fund: "Student Fund / Program",
};

// Users can only ever set "draft" or "pending_review"; the rest are operator outcomes.
export type VerificationStatus = "draft" | "pending_review" | "verified" | "rejected";

export const IV2_BOUNDARY = "Unverified investors can browse preview decks and flag deals. Access to confidential pitch decks, financial metrics, and founder contact is unlocked only after operator verification.";
export const IN_REVIEW_MESSAGE = "Application In Review — 48-Hour SLA. You can currently browse preview decks. Sensitive metrics and founder contact unlock upon approval.";
export const VERIFIED_MESSAGE = "Verified Investor Badge Active.";

export const REGULATED_AUTHORITIES = ["CySEC", "FCA", "BaFin", "AMF", "CSSF", "SEC", "Other", "Not regulated"] as const;

// Private storage bucket for evidence (SEC-2). Files live under `<user id>/<uuid>.<ext>`.
export const EVIDENCE_BUCKET = "verification-evidence";
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const EVIDENCE_MIME_EXTENSIONS: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };
export const EVIDENCE_SIGNED_URL_SECONDS = 10 * 60;

const EVIDENCE_PATH_PATTERN = /^([0-9a-f-]{36})\/[0-9a-f-]{36}\.(pdf|png|jpg)$/;

/** True when `path` is a well-formed evidence path, optionally inside the given user's folder. */
export function isEvidencePath(path: string, userId?: string) {
  const match = EVIDENCE_PATH_PATTERN.exec(path);
  return match !== null && (userId === undefined || match[1] === userId);
}

type TypeConfig = {
  evidenceType: string;
  intro: string;
  firmLabel: string | null;
  firmPlaceholder?: string;
  uploadLabel: string;
  uploadRequired: boolean;
};

export const INVESTOR_TYPE_CONFIG: Record<InvestorType, TypeConfig> = {
  angel: {
    evidenceType: "angel_proof",
    intro: "Upload your CyBAN / HeBAN membership certificate, or cap-table proof of a previous investment.",
    firmLabel: "Angel network membership",
    firmPlaceholder: "e.g. CyBAN, HeBAN",
    uploadLabel: "Membership certificate or cap-table proof",
    uploadRequired: true,
  },
  vc: {
    evidenceType: "employment_proof",
    intro: "Upload an HR certificate, employment letter, or fund registration proof.",
    firmLabel: "Fund name",
    uploadLabel: "HR certificate, employment letter or fund registration proof",
    uploadRequired: true,
  },
  general: {
    evidenceType: "accountant_certification",
    intro: "Upload a CPA / Accountant certification letter confirming an investable portfolio above €500k.",
    firmLabel: null,
    uploadLabel: "CPA / Accountant certification letter (>€500k portfolio)",
    uploadRequired: true,
  },
  student_fund: {
    evidenceType: "fund_mandate",
    intro: "Upload the university / programme fund mandate documentation.",
    firmLabel: "University affiliation",
    uploadLabel: "University / programme fund mandate documentation",
    uploadRequired: true,
  },
};

export type InvestorFormState = {
  investorType: InvestorType | "";
  firm: string;
  title: string;
  regulatedAuthority: string;
  capTableLinks: string;
  fundsStudentCompanies: boolean;
  evidenceFilePath: string;
};
export type InvestorFormField = keyof InvestorFormState;

export const emptyInvestorForm: InvestorFormState = {
  investorType: "",
  firm: "",
  title: "",
  regulatedAuthority: "",
  capTableLinks: "",
  fundsStudentCompanies: false,
  evidenceFilePath: "",
};

const splitLinks = (value: string) => value.split(/\s+/).filter(Boolean);
const shortText = z.string().trim().max(200, "Keep this under 200 characters.");

export const investorVerificationSchema = z
  .object({
    investorType: z.enum(INVESTOR_TYPES, "Select your investor type."),
    firm: shortText,
    title: shortText,
    regulatedAuthority: z.string().refine((value) => value === "" || (REGULATED_AUTHORITIES as readonly string[]).includes(value), "Select a regulator from the list."),
    capTableLinks: z.string().trim().max(1500, "Keep this under 1,500 characters.").refine((value) => splitLinks(value).every((link) => isHttpUrl(link)), "Enter full URLs starting with https://, one per line."),
    fundsStudentCompanies: z.boolean(),
    evidenceFilePath: z.string().refine((value) => value === "" || isEvidencePath(value), "Upload the document again."),
  })
  .superRefine((values, context) => {
    const need = (field: InvestorFormField, message: string) => {
      if (!values[field]) context.addIssue({ code: "custom", path: [field], message });
    };
    const config = INVESTOR_TYPE_CONFIG[values.investorType];
    // Angels may leave the network name blank (cap-table proof alone is enough); every type must upload a document.
    if (config.firmLabel && values.investorType !== "angel") need("firm", `${config.firmLabel} is required.`);
    if (values.investorType === "vc") {
      need("title", "Your title at the fund is required.");
      need("regulatedAuthority", "Select the fund's regulator.");
    }
    need("evidenceFilePath", "Upload the required document.");
  });

export type InvestorVerificationValues = z.infer<typeof investorVerificationSchema>;

export type InvestorProfileRow = {
  user_id: string;
  investor_type: InvestorType | null;
  funds_student_companies: boolean;
  firm: string | null;
  title: string | null;
  evidence_type: string | null;
  evidence_file_path: string | null;
  evidence: { regulatedAuthority?: string; capTableLinks?: string[] } | null;
  verification_status: VerificationStatus;
  reviewer_notes: string | null;
  submitted_at: string | null;
  verified_at: string | null;
};

export const INVESTOR_PROFILE_COLUMNS = "user_id, investor_type, funds_student_companies, firm, title, evidence_type, evidence_file_path, evidence, verification_status, reviewer_notes, submitted_at, verified_at";

/** Maps validated form values to the columns the investor is allowed to write. */
export function investorValuesToRow(values: InvestorVerificationValues) {
  const { investorType } = values;
  return {
    investor_type: investorType,
    funds_student_companies: investorType === "student_fund" || values.fundsStudentCompanies,
    firm: (INVESTOR_TYPE_CONFIG[investorType].firmLabel && values.firm) || null,
    title: investorType === "vc" ? values.title : null,
    evidence_type: values.evidenceFilePath ? INVESTOR_TYPE_CONFIG[investorType].evidenceType : null,
    evidence_file_path: values.evidenceFilePath || null,
    evidence: {
      ...(investorType === "vc" ? { regulatedAuthority: values.regulatedAuthority } : {}),
      ...(investorType === "angel" ? { capTableLinks: splitLinks(values.capTableLinks) } : {}),
    },
  };
}

export function rowToInvestorForm(row: InvestorProfileRow): InvestorFormState {
  return {
    investorType: row.investor_type ?? "",
    firm: row.firm ?? "",
    title: row.title ?? "",
    regulatedAuthority: row.evidence?.regulatedAuthority ?? "",
    capTableLinks: (row.evidence?.capTableLinks ?? []).join("\n"),
    fundsStudentCompanies: row.funds_student_companies,
    evidenceFilePath: row.evidence_file_path ?? "",
  };
}
