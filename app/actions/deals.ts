"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { saveDeal } from "@/lib/deals";
import { createClient } from "@/lib/supabase/server";

export type FlagDealResult = { success: false; needsAuth: true } | { success: false; needsAuth: false; error: string };

const flagSchema = z.object({ startupId: z.uuid(), campaign: z.string().nullable() });

// DK-3 / AU-2: "Flag for Later". Signed-out visitors are told to sign in (the deck then opens
// the sign-in modal); signed-in users get the deal saved and are taken to its detail page.
export async function flagDeal(input: unknown): Promise<FlagDealResult> {
  const parsed = flagSchema.safeParse(input);
  if (!parsed.success) return { success: false, needsAuth: false, error: "This deal is no longer available." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, needsAuth: true };

  const saved = await saveDeal(supabase, user.id, parsed.data.startupId, parsed.data.campaign);
  if (!saved) return { success: false, needsAuth: false, error: "We couldn't save this deal. Please try again." };

  redirect(`/deals/${parsed.data.startupId}`);
}
