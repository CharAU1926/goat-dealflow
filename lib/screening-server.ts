import { createClient } from "@supabase/supabase-js";
import { checkContent, checkDuplicates, checkEmail, checkEvidenceFile, checkLink, dedupeFlags, type ScreeningFlag } from "@/lib/screening";

// Server-only helpers (not server actions). Screening needs to compare a submission with other
// applicants' rows and to store flags the applicant cannot edit, so it uses the service role.
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

type Table = "startups" | "cofounder_profiles";

async function recordFlags(table: Table, ownerColumn: "owner_user_id" | "user_id", userId: string, flags: ScreeningFlag[]) {
  const admin = adminClient();
  if (!admin) return console.error("Screening skipped: SUPABASE_SERVICE_ROLE_KEY is not configured.");
  const { error } = await admin.from(table).update({ screening_flags: flags, screened_at: new Date().toISOString() }).eq(ownerColumn, userId);
  if (error) console.error(`Screening save error (${table}):`, error);
}

type StartupScreenInput = { userId: string; email: string | null; name: string; oneLiner: string; description: string | null; useOfFunds: string | null; tractionSignal: string | null; website: string | null; pitchDeckUrl: string | null; evidenceFilePath: string | null };

/** Runs every PR-3 check on a submitted startup and stores the result for the operator queue. Never throws. */
export async function screenStartup(input: StartupScreenInput): Promise<ScreeningFlag[]> {
  try {
    const admin = adminClient();
    const { data: others } = admin ? await admin.from("startups").select("name, one_liner, description").neq("owner_user_id", input.userId).limit(5000) : { data: null };
    const copy = [input.oneLiner, input.description].filter(Boolean).join(" ");
    const flags = dedupeFlags([
      ...checkEmail(input.email),
      ...checkLink("Website", input.website),
      ...checkLink("Pitch deck", input.pitchDeckUrl, { file: true }),
      ...checkEvidenceFile(input.evidenceFilePath),
      ...checkDuplicates({ name: input.name, copy }, (others ?? []).map((row) => ({ name: row.name, copy: [row.one_liner, row.description].filter(Boolean).join(" ") }))),
      ...checkContent({ "One-liner": input.oneLiner, Description: input.description, "Use of funds": input.useOfFunds, "Traction signal": input.tractionSignal }),
    ]);
    await recordFlags("startups", "owner_user_id", input.userId, flags);
    return flags;
  } catch (error) {
    console.error("Startup screening failed:", error);
    return [];
  }
}

type FounderScreenInput = { userId: string; email: string | null; headline: string; bio: string; links: { label: string; url: string | null }[] };

/** Same checks for a co-founder profile: email, links, repeated bio text and prohibited content. */
export async function screenFounderProfile(input: FounderScreenInput): Promise<ScreeningFlag[]> {
  try {
    const admin = adminClient();
    const { data: others } = admin ? await admin.from("cofounder_profiles").select("bio").neq("user_id", input.userId).limit(5000) : { data: null };
    const flags = dedupeFlags([
      ...checkEmail(input.email),
      ...input.links.flatMap((link) => checkLink(link.label, link.url)),
      ...checkDuplicates({ copy: input.bio }, (others ?? []).map((row) => ({ copy: row.bio }))),
      ...checkContent({ Headline: input.headline, Bio: input.bio }),
    ]);
    await recordFlags("cofounder_profiles", "user_id", input.userId, flags);
    return flags;
  } catch (error) {
    console.error("Founder screening failed:", error);
    return [];
  }
}
