"use server";

import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { EVIDENCE_BUCKET, isEvidencePath, type VerificationStatus } from "@/lib/investor-verification";
import { STARTUP_EVIDENCE, startupVerificationSchema, type StartupFormField } from "@/lib/startups";
import { createClient } from "@/lib/supabase/server";

export type SubmitStartupVerificationResult =
  | { success: true; status: VerificationStatus }
  | { success: false; error: string; fieldErrors?: Partial<Record<StartupFormField, string>> };

// CS-1: stores the startup, its company-type evidence and the founder's declarations, and
// queues it for operator review. A founder has one startup submission for now.
export async function submitStartupVerification(formData: unknown): Promise<SubmitStartupVerificationResult> {
  const parsed = startupVerificationSchema.safeParse(formData);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<StartupFormField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as StartupFormField;
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

  const { data: existing } = await supabase.from("startups").select("id, verification_status").eq("owner_user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle<{ id: string; verification_status: VerificationStatus }>();
  if (existing?.verification_status === "verified") return { success: false, error: "Your startup is already verified." };
  if (existing?.verification_status === "pending_review") return { success: false, error: "Your submission is already in review." };

  // The document was uploaded straight from the browser, so confirm it is in this user's own
  // folder and really exists before attaching it.
  const { data: exists } = isEvidencePath(values.evidenceFilePath, user.id) ? await supabase.storage.from(EVIDENCE_BUCKET).exists(values.evidenceFilePath) : { data: false };
  if (!exists) return { success: false, error: "Please fix the highlighted fields.", fieldErrors: { evidenceFilePath: "We couldn't find your uploaded document. Please upload it again." } };

  const now = new Date().toISOString();
  const isRegistered = values.companyType === "registered";
  const row = {
    owner_user_id: user.id,
    name: values.name,
    one_liner: values.oneLiner,
    sectors: values.sectors,
    stage: values.stage,
    location: values.location,
    funding_sought: Number(values.fundingSought),
    traction_signal: values.tractionSignal,
    company_type: values.companyType,
    legal_name: isRegistered ? values.legalName : null,
    registration_number: isRegistered ? values.registrationNumber : null,
    registration_country: isRegistered ? values.registrationCountry : null,
    evidence_type: STARTUP_EVIDENCE[values.companyType].evidenceType,
    evidence_file_path: values.evidenceFilePath,
    safe_claims_declared_at: now,
    active_raise_confirmed_at: now,
    // Only an operator can verify a startup or set its funding scope; the database enforces that too.
    verification_status: "pending_review",
    submitted_at: now,
  };

  const { error } = existing ? await supabase.from("startups").update(row).eq("id", existing.id) : await supabase.from("startups").insert(row);
  if (error) {
    console.error("Startup verification save error:", error);
    return { success: false, error: error.message };
  }

  return { success: true, status: "pending_review" };
}
