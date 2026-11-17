"use server";

import { z } from "zod";
import { EVIDENCE_BUCKET, isEvidencePath } from "@/lib/investor-verification";
import { createClient } from "@/lib/supabase/server";

const registerSchema = z.object({ filePath: z.string(), purpose: z.enum(["investor", "startup"]) });

// IV-4: every file uploaded to the private evidence bucket is registered with a purge date as
// soon as it lands, so documents that are never attached to a submission are still tracked.
export async function registerEvidenceUpload(input: unknown): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Unknown upload." };
  const { filePath, purpose } = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Your session has expired. Please sign in again." };

  if (!isEvidencePath(filePath, user.id)) return { success: false, error: "Unknown upload." };
  const { data: exists } = await supabase.storage.from(EVIDENCE_BUCKET).exists(filePath);
  if (!exists) return { success: false, error: "We couldn't find the uploaded document. Please upload it again." };

  // `purge_after` is left to the database default (90 days), which users cannot extend.
  const { error } = await supabase.from("evidence_files").insert({ file_path: filePath, user_id: user.id, purpose });
  if (error && error.code !== "23505") {
    console.error("Evidence registration error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
