"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { EVIDENCE_BUCKET, isEvidencePath, type VerificationStatus } from "@/lib/investor-verification";
import { STARTUP_EVIDENCE, formatLocation, getStartupCompleteness, startupProfileSchema, startupVerificationSchema, type StartupFormField, type StartupProfileField } from "@/lib/startups";
import { screenStartup } from "@/lib/screening-server";
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

  const { data: existing } = await supabase.from("startups").select("id, verification_status, description, use_of_funds, website, pitch_deck_url").eq("owner_user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle<{ id: string; verification_status: VerificationStatus; description: string | null; use_of_funds: string | null; website: string | null; pitch_deck_url: string | null }>();
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

  // PR-3: screening never blocks the submission; flags are shown to the operator.
  await screenStartup({ userId: user.id, email: user.email ?? profile.email ?? null, name: values.name, oneLiner: values.oneLiner, description: existing?.description ?? null, useOfFunds: existing?.use_of_funds ?? null, tractionSignal: values.tractionSignal, website: existing?.website ?? null, pitchDeckUrl: existing?.pitch_deck_url ?? null, evidenceFilePath: values.evidenceFilePath });

  return { success: true, status: "pending_review" };
}

export type SaveStartupProfileResult =
  | { success: true; status: "draft" | "pending_review" | "rejected" }
  | { success: false; error: string; fieldErrors?: Partial<Record<StartupProfileField, string>> };

const intentSchema = z.enum(["draft", "submit"]);

// PR-1 / PR-2: saves the founder's startup profile (separate from their co-founder profile).
// A draft only needs well-formed values; submitting needs every required field and both
// declarations, and queues the startup for operator review as 'pending_review'.
export async function saveStartupProfile(input: unknown, intent: unknown): Promise<SaveStartupProfileResult> {
  const parsedIntent = intentSchema.safeParse(intent);
  if (!parsedIntent.success) return { success: false, error: "Unknown action." };
  const parsed = startupProfileSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<StartupProfileField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as StartupProfileField;
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

  const { data: existing } = await supabase.from("startups").select("id, verification_status, submitted_at").eq("owner_user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle<{ id: string; verification_status: VerificationStatus; submitted_at: string | null }>();
  const current = existing?.verification_status ?? "draft";
  if (current === "verified") return { success: false, error: "Your startup is verified. Contact the GOAT team to change it." };

  // A startup already in review goes back through review on every edit, so it must stay complete.
  const submitting = parsedIntent.data === "submit" || current === "pending_review";
  const now = new Date().toISOString();
  if (submitting) {
    const { fieldErrors } = getStartupCompleteness(values);
    if (!values.safeClaimsDeclared) fieldErrors.safeClaimsDeclared = "Please accept the safe claims declaration.";
    if (!values.activeRaiseConfirmed) fieldErrors.activeRaiseConfirmed = "Please confirm the raise status.";
    // The document was uploaded straight from the browser, so confirm it is in this user's own
    // folder and really exists before attaching it.
    if (!fieldErrors.evidenceFilePath) {
      const { data: exists } = await supabase.storage.from(EVIDENCE_BUCKET).exists(values.evidenceFilePath);
      if (!exists || !isEvidencePath(values.evidenceFilePath, user.id)) fieldErrors.evidenceFilePath = "We couldn't find your uploaded document. Please upload it again.";
    }
    if (Object.keys(fieldErrors).length > 0) return { success: false, error: "Complete every required field before submitting for review.", fieldErrors };
  }
  const status = submitting ? "pending_review" : current;
  const isRegistered = values.companyType === "registered";

  const row = {
    owner_user_id: user.id,
    name: values.name,
    one_liner: values.oneLiner,
    description: values.description || null,
    sectors: values.sectors,
    stage: values.stage,
    location: formatLocation(values.city, values.country) || null,
    funding_sought: Number(values.fundingSought || 0),
    use_of_funds: values.useOfFunds || null,
    traction_signal: values.tractionSignal || null,
    website: values.websiteUrl || null,
    pitch_deck_url: values.pitchDeckUrl || null,
    company_type: values.companyType,
    registration_number: isRegistered ? values.registrationNumber || null : null,
    evidence_type: values.companyType ? STARTUP_EVIDENCE[values.companyType].evidenceType : null,
    evidence_file_path: values.evidenceFilePath || null,
    // Only an operator can verify a startup or set its funding scope; the database enforces that too.
    verification_status: status,
    ...(submitting ? { safe_claims_declared_at: now, active_raise_confirmed_at: now, submitted_at: current === "pending_review" && existing?.submitted_at ? existing.submitted_at : now } : {}),
  };

  const { error } = existing ? await supabase.from("startups").update(row).eq("id", existing.id) : await supabase.from("startups").insert(row);
  if (error) {
    console.error("Startup profile save error:", error);
    return { success: false, error: error.message };
  }

  if (submitting) await screenStartup({ userId: user.id, email: user.email ?? profile.email ?? null, name: values.name, oneLiner: values.oneLiner, description: values.description, useOfFunds: values.useOfFunds, tractionSignal: values.tractionSignal, website: values.websiteUrl, pitchDeckUrl: values.pitchDeckUrl, evidenceFilePath: values.evidenceFilePath });

  return { success: true, status };
}
