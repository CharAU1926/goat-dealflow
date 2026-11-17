"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { INTEREST_COLUMNS, MESSAGE_COLUMNS, MESSAGE_MAX_LENGTH, NOTE_MAX_LENGTH, type InterestRow, type MessageRow } from "@/lib/cofounders";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type InterestActionResult = { success: true; matchId: string | null } | { success: false; error: string };
export type SendMessageResult = { success: true; message: MessageRow } | { success: false; error: string };

const SIGNED_OUT = "Your session has expired. Please sign in again.";

async function requireUser(): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

const expressSchema = z.object({ toUserId: z.uuid(), note: z.string().trim().max(NOTE_MAX_LENGTH, `Keep your note under ${NOTE_MAX_LENGTH} characters.`) });

// CF: express interest in another founder. The database only accepts this from an approved
// founder, towards an approved founder; these checks exist to give a clear message first.
export async function expressInterest(input: unknown): Promise<InterestActionResult> {
  const parsed = expressSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const { toUserId, note } = parsed.data;

  const session = await requireUser();
  if (!session) return { success: false, error: SIGNED_OUT };
  const { supabase, userId } = session;
  if (toUserId === userId) return { success: false, error: "You cannot express interest in your own profile." };

  const limit = rateLimit(`interest:${userId}`, 20, 60 * 60 * 1000);
  if (!limit.allowed) return { success: false, error: "You have sent a lot of interests in the last hour. Please try again later." };

  const { data: own } = await supabase.from("cofounder_profiles").select("visibility_status").eq("user_id", userId).maybeSingle<{ visibility_status: string }>();
  if (own?.visibility_status !== "approved") return { success: false, error: "Your founder profile must be approved before you can express interest." };

  const { data: between } = await supabase
    .from("cofounder_interests")
    .select(INTEREST_COLUMNS)
    .or(`and(from_user_id.eq.${userId},to_user_id.eq.${toUserId}),and(from_user_id.eq.${toUserId},to_user_id.eq.${userId})`)
    .overrideTypes<InterestRow[]>();
  const existing = between ?? [];

  const matched = existing.find((interest) => interest.status === "accepted");
  if (matched) return { success: true, matchId: matched.id };

  // They already asked first: expressing interest back is an acceptance.
  const incoming = existing.find((interest) => interest.from_user_id === toUserId && interest.status === "pending");
  if (incoming) return updateStatus(supabase, incoming.id, "accepted");

  const outgoing = existing.find((interest) => interest.from_user_id === userId);
  if (outgoing?.status === "pending") return { success: false, error: "You have already expressed interest in this founder." };
  if (outgoing?.status === "declined") return { success: false, error: "This founder is not available to connect." };

  const { error } = outgoing
    ? await supabase.from("cofounder_interests").update({ status: "pending", note: note || null }).eq("id", outgoing.id)
    : await supabase.from("cofounder_interests").insert({ from_user_id: userId, to_user_id: toUserId, note: note || null });
  if (error) {
    console.error("Express interest error:", error);
    return { success: false, error: error.code === "42501" ? "This founder is not available to connect." : error.message };
  }

  revalidatePath("/cofounders");
  return { success: true, matchId: null };
}

async function updateStatus(supabase: SupabaseClient, interestId: string, status: "accepted" | "declined" | "withdrawn"): Promise<InterestActionResult> {
  // The database decides who may make which change; a refused change comes back as zero rows or an error.
  const { data, error } = await supabase.from("cofounder_interests").update({ status }).eq("id", interestId).eq("status", "pending").select("id");
  if (error) {
    console.error("Interest update error:", error);
    return { success: false, error: error.code === "42501" ? "You cannot make this change." : error.message };
  }
  if (data.length === 0) return { success: false, error: "This interest is no longer pending. Refresh the page." };

  revalidatePath("/cofounders");
  return { success: true, matchId: status === "accepted" ? interestId : null };
}

const respondSchema = z.object({ interestId: z.uuid(), action: z.enum(["accept", "decline", "withdraw"]) });
const RESPONSE_STATUS = { accept: "accepted", decline: "declined", withdraw: "withdrawn" } as const;

export async function respondToInterest(input: unknown): Promise<InterestActionResult> {
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Unknown request." };
  const session = await requireUser();
  if (!session) return { success: false, error: SIGNED_OUT };
  return updateStatus(session.supabase, parsed.data.interestId, RESPONSE_STATUS[parsed.data.action]);
}

const messageSchema = z.object({
  matchId: z.uuid(),
  content: z.string().trim().min(1, "Write a message first.").max(MESSAGE_MAX_LENGTH, `Keep messages under ${MESSAGE_MAX_LENGTH} characters.`),
});

// IN-2 / IN-3: the database only stores a message when the sender is one of the two founders
// of an accepted interest.
export async function sendMessage(input: unknown): Promise<SendMessageResult> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const session = await requireUser();
  if (!session) return { success: false, error: SIGNED_OUT };

  const limit = rateLimit(`message:${session.userId}`, 30, 60 * 1000);
  if (!limit.allowed) return { success: false, error: "You are sending messages too quickly. Please wait a moment." };

  const { data, error } = await session.supabase
    .from("messages")
    .insert({ match_id: parsed.data.matchId, sender_id: session.userId, content: parsed.data.content })
    .select(MESSAGE_COLUMNS)
    .single<MessageRow>();
  if (error) {
    console.error("Send message error:", error);
    return { success: false, error: error.code === "42501" ? "This conversation is not open." : error.message };
  }
  return { success: true, message: data };
}
