import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCampaign } from "@/lib/startups";

/**
 * AU-3: saves a flagged deal for the signed-in user. Only deals that are live in the Tier 0
 * view can be saved, and saving the same deal twice is not an error.
 */
export async function saveDeal(supabase: SupabaseClient, userId: string, startupId: string, campaign: string | null) {
  const { data: teaser } = await supabase.from("startup_teasers").select("id").eq("id", startupId).maybeSingle();
  if (!teaser) return false;

  const { error } = await supabase.from("saved_deals").insert({ user_id: userId, startup_id: startupId, campaign: normalizeCampaign(campaign) });
  if (error && error.code !== "23505") {
    console.error("Save deal error:", error);
    return false;
  }
  return true;
}
