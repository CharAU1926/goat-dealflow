"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { EVIDENCE_BUCKET, EVIDENCE_SIGNED_URL_SECONDS, isEvidencePath } from "@/lib/investor-verification";
import { EVIDENCE_RETENTION_DAYS_AFTER_DECISION, REASON_CODES, type ReviewAction, type ReviewActionResult, type ReviewTarget, type SignedUrlResult } from "@/lib/operator";
import { createClient } from "@/lib/supabase/server";

const NOT_OPERATOR = "Operator access is required.";
const STALE = "This application is no longer pending review. Refresh the queue.";

// Every action re-checks the caller's role on the server; the page gate alone is not trusted.
// Row-level security applies the same rule again inside the database.
async function requireOperator(): Promise<{ supabase: SupabaseClient; operatorId: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await getProfile(supabase, user.id);
  return profile?.role === "operator" ? { supabase, operatorId: user.id } : null;
}

// A reason from the checklist is mandatory for every decision other than an approval.
const hasValidReason = (target: ReviewTarget) => (input: { action: ReviewAction; reasonCode?: string | null }) =>
  input.action === "approve" || (typeof input.reasonCode === "string" && Object.hasOwn(REASON_CODES[target], input.reasonCode));
const REASON_REQUIRED = "Choose a reason before continuing.";

async function writeAuditLog(supabase: SupabaseClient, entry: { operator_id: string; target_user_id: string; action: ReviewAction; target_type: ReviewTarget; reason_code: string | null }): Promise<ReviewActionResult> {
  const { error } = await supabase.from("operator_audit_logs").insert(entry);
  if (error) {
    console.error("Audit log write failed:", error, entry);
    return { success: false, error: `The decision was saved, but the audit log entry failed: ${error.message}` };
  }
  revalidatePath("/operator/review");
  return { success: true };
}

// IV-4: a final decision starts the clock on deleting the evidence that supported it.
async function scheduleEvidencePurge(supabase: SupabaseClient, filePath: string | null) {
  if (!filePath) return;
  const purgeAfter = new Date(Date.now() + EVIDENCE_RETENTION_DAYS_AFTER_DECISION * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("evidence_files").update({ purge_after: purgeAfter }).eq("file_path", filePath).is("purged_at", null);
  if (error) console.error("Evidence purge scheduling failed:", error);
}

const investorReviewSchema = z
  .object({ investorUserId: z.uuid(), action: z.enum(["approve", "request_changes", "reject"]), reasonCode: z.string().nullish() })
  .refine(hasValidReason("investor"), REASON_REQUIRED);

export async function reviewInvestorAction(input: { investorUserId: string; action: ReviewAction; reasonCode?: string | null }): Promise<ReviewActionResult> {
  const parsed = investorReviewSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const operator = await requireOperator();
  if (!operator) return { success: false, error: NOT_OPERATOR };

  const { action, investorUserId } = parsed.data;
  const reasonCode = action === "approve" ? null : (parsed.data.reasonCode ?? null);
  const changes = reasonCode
    ? { verification_status: action === "reject" ? "rejected" : "draft", verified_at: null, reviewer_notes: REASON_CODES.investor[reasonCode] }
    : { verification_status: "verified", verified_at: new Date().toISOString(), reviewer_notes: null };

  // Only applications still in the queue can be decided, so two operators cannot both act on one.
  const { data, error } = await operator.supabase
    .from("investor_profiles")
    .update({ ...changes, reviewer_id: operator.operatorId })
    .eq("user_id", investorUserId)
    .eq("verification_status", "pending_review")
    .select("user_id, evidence_file_path");
  if (error) {
    console.error("Investor review error:", error);
    return { success: false, error: error.message };
  }
  if (data.length === 0) return { success: false, error: STALE };
  if (action !== "request_changes") await scheduleEvidencePurge(operator.supabase, data[0].evidence_file_path);

  return writeAuditLog(operator.supabase, { operator_id: operator.operatorId, target_user_id: investorUserId, action, target_type: "investor", reason_code: reasonCode });
}

const founderReviewSchema = z
  .object({ founderUserId: z.uuid(), action: z.enum(["approve", "request_changes"]), reasonCode: z.string().nullish() })
  .refine(hasValidReason("founder"), REASON_REQUIRED);

export async function reviewFounderAction(input: { founderUserId: string; action: Exclude<ReviewAction, "reject">; reasonCode?: string | null }): Promise<ReviewActionResult> {
  const parsed = founderReviewSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const operator = await requireOperator();
  if (!operator) return { success: false, error: NOT_OPERATOR };

  const { action, founderUserId } = parsed.data;
  const reasonCode = action === "approve" ? null : (parsed.data.reasonCode ?? null);
  const changes = reasonCode ? { visibility_status: "draft", reviewer_notes: REASON_CODES.founder[reasonCode] } : { visibility_status: "approved", reviewer_notes: null };

  const { data, error } = await operator.supabase
    .from("cofounder_profiles")
    .update(changes)
    .eq("user_id", founderUserId)
    .eq("visibility_status", "pending_review")
    .select("user_id");
  if (error) {
    console.error("Founder review error:", error);
    return { success: false, error: error.message };
  }
  if (data.length === 0) return { success: false, error: STALE };

  return writeAuditLog(operator.supabase, { operator_id: operator.operatorId, target_user_id: founderUserId, action, target_type: "founder", reason_code: reasonCode });
}

const startupReviewSchema = z
  .object({ startupId: z.uuid(), action: z.enum(["approve", "request_changes", "reject"]), reasonCode: z.string().nullish() })
  .refine(hasValidReason("startup"), REASON_REQUIRED);

export async function reviewStartupAction(input: { startupId: string; action: ReviewAction; reasonCode?: string | null }): Promise<ReviewActionResult> {
  const parsed = startupReviewSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const operator = await requireOperator();
  if (!operator) return { success: false, error: NOT_OPERATOR };

  const { action, startupId } = parsed.data;
  const reasonCode = action === "approve" ? null : (parsed.data.reasonCode ?? null);

  const { data: startup } = await operator.supabase.from("startups").select("company_type").eq("id", startupId).maybeSingle<{ company_type: string | null }>();
  if (!startup) return { success: false, error: STALE };

  // CS-1: approval decides who may see the company. Student ventures go to student funds only;
  // registered companies go to all verified investors.
  const changes = reasonCode
    ? { verification_status: action === "reject" ? "rejected" : "draft", verified_at: null, reviewer_notes: REASON_CODES.startup[reasonCode] }
    : { verification_status: "verified", verified_at: new Date().toISOString(), reviewer_notes: null, funding_scope: startup.company_type === "registered" ? "all_investors" : "student_funds_only" };

  const { data, error } = await operator.supabase
    .from("startups")
    .update({ ...changes, reviewer_id: operator.operatorId })
    .eq("id", startupId)
    .eq("verification_status", "pending_review")
    .select("owner_user_id, evidence_file_path");
  if (error) {
    console.error("Startup review error:", error);
    return { success: false, error: error.message };
  }
  if (data.length === 0) return { success: false, error: STALE };
  if (action !== "request_changes") await scheduleEvidencePurge(operator.supabase, data[0].evidence_file_path);
  if (action === "approve") revalidatePath("/d/[campaign]", "page");

  return writeAuditLog(operator.supabase, { operator_id: operator.operatorId, target_user_id: data[0].owner_user_id, action, target_type: "startup", reason_code: reasonCode });
}

// SEC-2: evidence is never public. An operator gets a link that expires after 10 minutes.
export async function getEvidenceSignedUrl(filePath: string): Promise<SignedUrlResult> {
  if (typeof filePath !== "string" || !isEvidencePath(filePath)) return { success: false, error: "Unknown evidence document." };
  const operator = await requireOperator();
  if (!operator) return { success: false, error: NOT_OPERATOR };

  // Only documents attached to an application can be opened, not arbitrary files in the bucket.
  const [{ data: investorDocs }, { data: startupDocs }] = await Promise.all([
    operator.supabase.from("investor_profiles").select("user_id").eq("evidence_file_path", filePath).limit(1),
    operator.supabase.from("startups").select("id").eq("evidence_file_path", filePath).limit(1),
  ]);
  if (!investorDocs?.length && !startupDocs?.length) return { success: false, error: "Unknown evidence document." };

  const { data, error } = await operator.supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(filePath, EVIDENCE_SIGNED_URL_SECONDS);
  if (error || !data) {
    console.error("Signed URL error:", error);
    return { success: false, error: error?.message ?? "Could not open the document." };
  }
  return { success: true, url: data.signedUrl, expiresInSeconds: EVIDENCE_SIGNED_URL_SECONDS };
}
