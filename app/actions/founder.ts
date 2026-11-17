"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { founderProfileSchema, getCompleteness, getCredentials, type FounderProfileField, type ProfileStatus } from "@/lib/founder-profile";
import { createClient } from "@/lib/supabase/server";

export type SaveFounderProfileResult =
  | { success: true; status: ProfileStatus }
  | { success: false; error: string; fieldErrors?: Partial<Record<FounderProfileField, string>> };

const intentSchema = z.enum(["draft", "submit"]);

export async function saveFounderProfile(input: unknown, intent: unknown): Promise<SaveFounderProfileResult> {
  const parsedIntent = intentSchema.safeParse(intent);
  const parsed = founderProfileSchema.safeParse(input);
  if (!parsedIntent.success) return { success: false, error: "Unknown action." };
  if (!parsed.success) {
    const fieldErrors: Partial<Record<FounderProfileField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as FounderProfileField;
      fieldErrors[field] ??= issue.message;
    }
    return { success: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const values = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (!profile?.age_confirmed_at) redirect("/onboarding");
  if (profile.role !== "founder") return { success: false, error: "This account is not registered as a founder." };

  const { data: existing } = await supabase.from("cofounder_profiles").select("visibility_status, submitted_at").eq("user_id", user.id).maybeSingle<{ visibility_status: ProfileStatus; submitted_at: string | null }>();
  const current = existing?.visibility_status ?? "draft";

  // A profile that is in review or approved goes (back) to review on every edit, so it must stay
  // complete. Only an operator can move it to "approved"; the database enforces that as well.
  const submitting = parsedIntent.data === "submit" || current === "pending_review" || current === "approved";
  if (submitting) {
    const missingCredential = getCredentials(values, Boolean(user.email_confirmed_at)).find((credential) => !credential.done);
    if (missingCredential) return { success: false, error: `Verification credential missing: ${missingCredential.label}.` };
    if (getCompleteness(values).percent < 100) return { success: false, error: "Complete every required section before submitting for review." };
  }
  const status: ProfileStatus = submitting ? "pending_review" : current;

  const { error } = await supabase.from("cofounder_profiles").upsert({
    user_id: user.id,
    name: values.fullName,
    headline: values.headline,
    bio: values.bio,
    location: values.location,
    languages: values.languages,
    skills: values.skills,
    roles_sought: values.rolesSought,
    commitment: values.commitment,
    equity_min: values.equityMin,
    equity_max: values.equityMax,
    linkedin_url: values.linkedinUrl || null,
    github_url: values.githubUrl || null,
    portfolio_url: values.portfolioUrl || null,
    company_type: values.companyType,
    visibility_status: status,
    submitted_at: status === "pending_review" ? (current === "pending_review" && existing?.submitted_at ? existing.submitted_at : new Date().toISOString()) : null,
  });

  if (error) {
    console.error("Founder profile save error:", error);
    return { success: false, error: error.message };
  }

  const { error: profileError } = await supabase.from("profiles").update({ full_name: values.fullName || null }).eq("id", user.id);
  if (profileError) console.error("Profile name update error:", profileError);

  return { success: true, status };
}
