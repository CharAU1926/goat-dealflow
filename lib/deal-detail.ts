import { z } from "zod";
import { isHttpUrl } from "@/lib/founder-profile";
import type { StartupTeaser } from "@/lib/startups";

// DK-9 Tier 1 (any signed-in user). Exactly the columns of the `startup_profiles` view.
export type StartupProfile = StartupTeaser & {
  description: string | null;
  team_bios: unknown;
  use_of_funds: string | null;
  website: string | null;
};
export const PROFILE_COLUMNS = "id, name, one_liner, sectors, stage, location, funding_sought, traction_signal, description, team_bios, use_of_funds, website";

// DK-9 Tier 2 (verified investors only), as returned by the `get_startup_confidential` function.
export type ConfidentialRow = { pitch_deck_url: string | null; confidential_metrics: unknown; has_contact: boolean };

const teamSchema = z.array(z.object({ name: z.string().trim().min(1).max(120), role: z.string().trim().max(120).optional(), bio: z.string().trim().max(1200).optional() }));
const metricsSchema = z.array(z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().max(160) }));

export const parseTeam = (value: unknown) => { const parsed = teamSchema.safeParse(value); return parsed.success ? parsed.data : []; };
export const parseMetrics = (value: unknown) => { const parsed = metricsSchema.safeParse(value); return parsed.success ? parsed.data : []; };
export const safeUrl = (value: string | null) => (value && isHttpUrl(value) ? value : null);

// CS-4 / IN-1: the introduction e-mail. Control characters are stripped so a company name
// cannot inject extra headers into the mail client.
const clean = (value: string) => value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

export function introductionSubject(investorName: string, startupName: string) {
  return `Khora Flow Introduction: ${clean(investorName)} x ${clean(startupName)}`;
}

export function buildMailto(email: string, subject: string) {
  return `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}`;
}
