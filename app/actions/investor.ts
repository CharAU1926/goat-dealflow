"use server";

import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { EVIDENCE_BUCKET, investorValuesToRow, investorVerificationSchema, isEvidencePath, type InvestorFormField, type VerificationStatus } from "@/lib/investor-verification";
import { createClient } from "@/lib/supabase/server";

export type SubmitInvestorVerificationResult =
  | { success: true; status: VerificationStatus }
  | { success: false; error: string; fieldErrors?: Partial<Record<InvestorFormField, string>> };

// IV-1: stores the investor's type and evidence, and queues the application for operator review.
export async function submitInvestorVerification(formData: unknown): Promise<SubmitInvestorVerificationResult> {
  const parsed = investorVerificationSchema.safeParse(formData);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<InvestorFormField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as InvestorFormField;
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
  if (profile.role !== "investor") return { success: false, error: "This account is not registered as an investor." };

  const { data: existing } = await supabase.from("investor_profiles").select("verification_status").eq("user_id", user.id).maybeSingle<{ verification_status: VerificationStatus }>();
  if (existing?.verification_status === "verified") return { success: false, error: "Your investor status is already verified." };
  if (existing?.verification_status === "pending_review") return { success: false, error: "Your application is already in review." };

  // The file was uploaded straight from the browser, so confirm it sits in this user's own
  // folder and really exists before pointing the application at it.
  if (values.evidenceFilePath) {
    const uploadError = { success: false as const, error: "Please fix the highlighted fields.", fieldErrors: { evidenceFilePath: "We couldn't find your uploaded document. Please upload it again." } };
    if (!isEvidencePath(values.evidenceFilePath, user.id)) return uploadError;
    const { data: exists } = await supabase.storage.from(EVIDENCE_BUCKET).exists(values.evidenceFilePath);
    if (!exists) return uploadError;
  }

  // Only an operator can move an application past "pending_review"; the database enforces that too.
  const { error } = await supabase.from("investor_profiles").upsert({
    user_id: user.id,
    ...investorValuesToRow(values),
    verification_status: "pending_review",
    submitted_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Investor verification save error:", error);
    return { success: false, error: error.message };
  }

  return { success: true, status: "pending_review" };
}
