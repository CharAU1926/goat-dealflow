import { z } from "zod";

// Values mirror the check constraint on `public.investor_profiles` (investor_profiles_mandate_check).
export const MANDATE_SECTORS = ["SaaS", "FinTech", "DeepTech", "AI", "Health", "Maritime", "Other"] as const;
export const MANDATE_STAGES = ["pre_seed", "seed", "series_a"] as const;
export const MANDATE_STAGE_LABELS: Record<(typeof MANDATE_STAGES)[number], string> = { pre_seed: "Pre-Seed", seed: "Seed", series_a: "Series A" };
export const MANDATE_GEOGRAPHIES = ["cyprus", "greece", "pan_european"] as const;
export const MANDATE_GEOGRAPHY_LABELS: Record<(typeof MANDATE_GEOGRAPHIES)[number], string> = { cyprus: "Cyprus", greece: "Greece", pan_european: "Pan-European" };
export const MANDATE_COMPANY_TYPES = ["registered_only", "include_student"] as const;
export type MandateCompanyType = (typeof MANDATE_COMPANY_TYPES)[number];
export const MANDATE_COMPANY_TYPE_LABELS: Record<MandateCompanyType, string> = { registered_only: "Registered Companies", include_student: "Include Student Companies" };

const MAX_CHEQUE = 1_000_000_000;

export type MandateRow = {
  user_id: string;
  funds_student_companies: boolean;
  mandate_sectors: string[];
  mandate_stages: string[];
  mandate_geographies: string[];
  cheque_min: number | null;
  cheque_max: number | null;
  mandate_company_type: MandateCompanyType | null;
};
export const MANDATE_COLUMNS = "user_id, funds_student_companies, mandate_sectors, mandate_stages, mandate_geographies, cheque_min, cheque_max, mandate_company_type";

export type MandateFormState = {
  sectors: string[];
  stages: string[];
  geographies: string[];
  chequeMin: string;
  chequeMax: string;
  companyType: MandateCompanyType;
};
export type MandateFormField = keyof MandateFormState;

/** CS-5: registered companies only, unless the investor said they fund student companies. */
export function defaultCompanyType(fundsStudentCompanies: boolean): MandateCompanyType {
  return fundsStudentCompanies ? "include_student" : "registered_only";
}

/** A stored "include student" choice only counts while the investor still funds student companies. */
export function effectiveCompanyType(row: Pick<MandateRow, "funds_student_companies" | "mandate_company_type"> | null): MandateCompanyType {
  const fundsStudents = row?.funds_student_companies ?? false;
  const stored = row?.mandate_company_type ?? defaultCompanyType(fundsStudents);
  return stored === "include_student" && !fundsStudents ? "registered_only" : stored;
}

export function rowToMandateForm(row: MandateRow | null): MandateFormState {
  return {
    sectors: row?.mandate_sectors ?? [],
    stages: row?.mandate_stages ?? [],
    geographies: row?.mandate_geographies ?? [],
    chequeMin: row?.cheque_min != null ? String(row.cheque_min) : "",
    chequeMax: row?.cheque_max != null ? String(row.cheque_max) : "",
    companyType: effectiveCompanyType(row),
  };
}

const cheque = z.string().trim().refine((value) => value === "" || (/^\d{1,10}$/.test(value) && Number(value) <= MAX_CHEQUE), "Enter a whole number of euros up to 1,000,000,000.");

export const mandateSchema = z
  .object({
    sectors: z.array(z.enum(MANDATE_SECTORS)).max(MANDATE_SECTORS.length),
    stages: z.array(z.enum(MANDATE_STAGES)).max(MANDATE_STAGES.length),
    geographies: z.array(z.enum(MANDATE_GEOGRAPHIES)).max(MANDATE_GEOGRAPHIES.length),
    chequeMin: cheque,
    chequeMax: cheque,
    companyType: z.enum(MANDATE_COMPANY_TYPES),
  })
  .superRefine((values, context) => {
    if (values.chequeMin !== "" && values.chequeMax !== "" && Number(values.chequeMin) > Number(values.chequeMax)) {
      context.addIssue({ code: "custom", path: ["chequeMax"], message: "Maximum cheque must be at least the minimum." });
    }
  });

export type MandateValues = z.infer<typeof mandateSchema>;

export function mandateValuesToRow(values: MandateValues) {
  return {
    mandate_sectors: [...new Set(values.sectors)],
    mandate_stages: [...new Set(values.stages)],
    mandate_geographies: [...new Set(values.geographies)],
    cheque_min: values.chequeMin === "" ? null : Number(values.chequeMin),
    cheque_max: values.chequeMax === "" ? null : Number(values.chequeMax),
    mandate_company_type: values.companyType,
    mandate_updated_at: new Date().toISOString(),
  };
}
