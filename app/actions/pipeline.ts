"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveDeal } from "@/lib/deals";
import { getInvestorSession } from "@/lib/investor-session";
import { updateSavedDealSchema } from "@/lib/pipeline";

export type PipelineActionResult = { success: true } | { success: false; error: string };

const GENERIC_ERROR = "We couldn't update this deal. Please try again.";

// SD-1 / SD-2: moves a saved deal between pipeline columns and/or edits its private notes.
// Rows are scoped to the signed-in user here and by row-level security.
export async function updateSavedDeal(input: unknown): Promise<PipelineActionResult> {
  const parsed = updateSavedDealSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const session = await getInvestorSession();
  if (!session) return { success: false, error: "Please sign in with an investor account." };

  const patch: { pipeline_status?: string; notes?: string | null } = {};
  if (parsed.data.pipelineStatus) patch.pipeline_status = parsed.data.pipelineStatus;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes.trim() === "" ? null : parsed.data.notes;

  const { data, error } = await session.supabase.from("saved_deals").update(patch).eq("id", parsed.data.id).eq("user_id", session.user.id).select("id");
  if (error) {
    console.error("Saved deal update error:", error);
    return { success: false, error: GENERIC_ERROR };
  }
  if (!data?.length) return { success: false, error: "This deal is no longer in your pipeline." };
  return { success: true };
}

export async function removeSavedDeal(input: unknown): Promise<PipelineActionResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { success: false, error: GENERIC_ERROR };

  const session = await getInvestorSession();
  if (!session) return { success: false, error: "Please sign in with an investor account." };

  const { error } = await session.supabase.from("saved_deals").delete().eq("id", parsed.data.id).eq("user_id", session.user.id);
  if (error) {
    console.error("Saved deal delete error:", error);
    return { success: false, error: GENERIC_ERROR };
  }
  return { success: true };
}

// Used by the "Save to pipeline" button on the company page. Saving is a flag only (SD-3):
// it never contacts the company.
export async function saveToPipeline(formData: FormData) {
  const startupId = z.uuid().safeParse(formData.get("startupId"));
  if (!startupId.success) return;

  const session = await getInvestorSession();
  if (!session) return;

  await saveDeal(session.supabase, session.user.id, startupId.data, null);
  revalidatePath(`/deals/${startupId.data}`);
  revalidatePath("/pipeline");
}
