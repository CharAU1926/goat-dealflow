import { z } from "zod";

export const SKILL_TAXONOMY = {
  Technical: ["Frontend", "Backend", "AI / ML", "Data Engineering", "DevOps / Cloud", "Mobile", "Security", "Hardware / IoT"],
  Product: ["Product Management", "UX / UI Design", "User Research", "Product Analytics"],
  Growth: ["Sales", "Marketing", "Partnerships", "Fundraising", "Community"],
  Operations: ["Finance", "Legal / Compliance", "People / Hiring", "Business Operations", "Supply Chain"],
} as const;

export type SkillCategory = keyof typeof SKILL_TAXONOMY;
export type Skill = (typeof SKILL_TAXONOMY)[SkillCategory][number];

export const SKILL_CATEGORIES = Object.keys(SKILL_TAXONOMY) as SkillCategory[];
const ALL_SKILLS = Object.values(SKILL_TAXONOMY).flat() as [Skill, ...Skill[]];

export const ROLES_SOUGHT = ["CTO", "CEO", "Lead Dev", "Growth Lead"] as const;
export type RoleSought = (typeof ROLES_SOUGHT)[number];

export const COMMITMENTS = ["full_time", "part_time"] as const;
export type Commitment = (typeof COMMITMENTS)[number];
export const COMMITMENT_LABELS: Record<Commitment, string> = { full_time: "Full-time", part_time: "Part-time" };

// Values match the existing `public.company_type` database enum.
export const COMPANY_TYPES = ["student", "registered"] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];
export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = { student: "Student Project", registered: "Registered Company" };

export const DEFAULT_LOCATION = "Cyprus";
export const DEFAULT_LANGUAGES = ["English", "Greek"];
export const BIO_MIN_LENGTH = 80;
export const SKILLS_MIN = 3;

// Mirrors `cofounder_profiles.visibility_status`. Only operators can set "approved" (CF-9).
export type ProfileStatus = "draft" | "pending_review" | "approved" | "paused";

export function isHttpUrl(value: string, hosts?: string[]) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    return !hosts || hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

/** A public LinkedIn profile URL: linkedin.com/in/<handle>. */
export function isLinkedInProfileUrl(value: string) {
  return isHttpUrl(value, ["linkedin.com"]) && /^\/in\/[^/]+\/?$/.test(new URL(value).pathname);
}

const optionalUrl = (message: string, hosts?: string[]) =>
  z.string().trim().max(300, "Keep links under 300 characters.").refine((value) => value === "" || isHttpUrl(value, hosts), message);

const unique = <T,>(values: T[]) => [...new Set(values)];

export const founderProfileSchema = z
  .object({
    fullName: z.string().trim().max(120, "Keep your name under 120 characters."),
    headline: z.string().trim().max(120, "Keep your headline under 120 characters."),
    bio: z.string().trim().max(1500, "Keep your bio under 1,500 characters."),
    location: z.string().trim().max(120, "Keep your location under 120 characters."),
    languages: z.array(z.string().trim().min(1).max(40)).max(12, "List up to 12 languages.").transform(unique),
    skills: z.array(z.enum(ALL_SKILLS)).transform(unique),
    rolesSought: z.array(z.enum(ROLES_SOUGHT)).transform(unique),
    commitment: z.enum(COMMITMENTS).nullable(),
    equityMin: z.number().int().min(0).max(100),
    equityMax: z.number().int().min(0).max(100),
    linkedinUrl: z.string().trim().max(300, "Keep links under 300 characters.").refine((value) => value === "" || isLinkedInProfileUrl(value), "Enter your public LinkedIn profile URL, e.g. https://www.linkedin.com/in/you."),
    githubUrl: optionalUrl("Enter a full GitHub URL, e.g. https://github.com/you.", ["github.com"]),
    portfolioUrl: optionalUrl("Enter a full URL starting with https://."),
    companyType: z.enum(COMPANY_TYPES).nullable(),
  })
  .refine((values) => values.equityMin <= values.equityMax, { path: ["equityMax"], message: "Maximum equity must be at least the minimum." });

export type FounderProfileValues = z.infer<typeof founderProfileSchema>;
export type FounderProfileField = keyof FounderProfileValues;

export const emptyFounderProfile: FounderProfileValues = {
  fullName: "",
  headline: "",
  bio: "",
  location: DEFAULT_LOCATION,
  languages: DEFAULT_LANGUAGES,
  skills: [],
  rolesSought: [],
  commitment: null,
  equityMin: 0,
  equityMax: 0,
  linkedinUrl: "",
  githubUrl: "",
  portfolioUrl: "",
  companyType: null,
};

// GitHub and Portfolio are optional: not every founder has them, so they never block verification.
const completenessChecks: { label: string; done: (values: FounderProfileValues) => boolean }[] = [
  { label: "Full name", done: (v) => v.fullName.trim().length > 1 },
  { label: "Headline", done: (v) => v.headline.trim().length > 2 },
  { label: `Bio (${BIO_MIN_LENGTH}+ characters)`, done: (v) => v.bio.trim().length >= BIO_MIN_LENGTH },
  { label: "City / location", done: (v) => v.location.trim().length > 1 },
  { label: "Languages", done: (v) => v.languages.length > 0 },
  { label: `Skills (${SKILLS_MIN}+)`, done: (v) => v.skills.length >= SKILLS_MIN },
  { label: "Role(s) sought", done: (v) => v.rolesSought.length > 0 },
  { label: "Commitment", done: (v) => v.commitment !== null },
  { label: "Equity expectation", done: (v) => v.equityMax > 0 && v.equityMin <= v.equityMax },
  { label: "LinkedIn profile URL", done: (v) => isLinkedInProfileUrl(v.linkedinUrl.trim()) },
  { label: "Company type", done: (v) => v.companyType !== null },
];

export function getCompleteness(values: FounderProfileValues): { percent: number; missing: string[] } {
  const missing = completenessChecks.filter((check) => !check.done(values)).map((check) => check.label);
  const percent = Math.round(((completenessChecks.length - missing.length) / completenessChecks.length) * 100);
  return { percent, missing };
}

// The three core founder verification credentials. Email is confirmed by Supabase Auth; the
// LinkedIn URL is format-checked here and confirmed by an operator during review.
export function getCredentials(values: FounderProfileValues, emailVerified: boolean): { label: string; done: boolean }[] {
  return [
    { label: "Verified email", done: emailVerified },
    { label: "Public LinkedIn profile URL", done: isLinkedInProfileUrl(values.linkedinUrl.trim()) },
    { label: `Bio of ${BIO_MIN_LENGTH}+ characters and ${SKILLS_MIN}+ skills`, done: values.bio.trim().length >= BIO_MIN_LENGTH && values.skills.length >= SKILLS_MIN },
  ];
}

export type CofounderProfileRow = {
  user_id: string;
  name: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  languages: string[] | null;
  skills: string[] | null;
  roles_sought: string[] | null;
  commitment: string | null;
  equity_min: number | null;
  equity_max: number | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  company_type: string | null;
  visibility_status: ProfileStatus;
  reviewer_notes: string | null;
  submitted_at: string | null;
  screening_flags?: unknown;
};

const includes = <T extends string>(options: readonly T[], value: string | null): value is T => value !== null && (options as readonly string[]).includes(value);

export function rowToFounderProfile(row: CofounderProfileRow): FounderProfileValues {
  return {
    fullName: row.name,
    headline: row.headline ?? "",
    bio: row.bio ?? "",
    location: row.location ?? DEFAULT_LOCATION,
    languages: row.languages ?? DEFAULT_LANGUAGES,
    skills: (row.skills ?? []).filter((skill): skill is Skill => includes(ALL_SKILLS, skill)),
    rolesSought: (row.roles_sought ?? []).filter((role): role is RoleSought => includes(ROLES_SOUGHT, role)),
    commitment: includes(COMMITMENTS, row.commitment) ? row.commitment : null,
    equityMin: Math.round(row.equity_min ?? 0),
    equityMax: Math.round(row.equity_max ?? 0),
    linkedinUrl: row.linkedin_url ?? "",
    githubUrl: row.github_url ?? "",
    portfolioUrl: row.portfolio_url ?? "",
    companyType: includes(COMPANY_TYPES, row.company_type) ? row.company_type : null,
  };
}
