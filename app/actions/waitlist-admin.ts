"use server";

import { revalidatePath } from "next/cache";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getOrigin, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { InviteResult } from "@/lib/waitlist";

async function requireOperator(): Promise<SupabaseClient | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await getProfile(supabase, user.id);
  return profile?.role === "operator" ? supabase : null;
}

// WL-2: invite one waitlist entry to the beta. Sending the email needs the Auth admin API, so the
// service-role key is used for that single call only; the status update runs as the operator.
export async function inviteWaitlistEntry(input: { id: string }): Promise<InviteResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { success: false, error: "Unknown waitlist entry." };
  const supabase = await requireOperator();
  if (!supabase) return { success: false, error: "Operator access is required." };

  const { data: entry } = await supabase.from("waitlist").select("id, email, status").eq("id", parsed.data.id).maybeSingle<{ id: string; email: string; status: string | null }>();
  if (!entry) return { success: false, error: "This waitlist entry no longer exists." };
  if (entry.status === "invited") return { success: false, error: "This person has already been invited." };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !serviceKey) {
    return { success: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured, so the invite email cannot be sent." };
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(entry.email, { redirectTo: `${await getOrigin()}/auth/callback` });

  // An existing account cannot be invited again, but it can still sign in once approved.
  const alreadyRegistered = inviteError?.status === 422 || /already.*(registered|exists)/i.test(inviteError?.message ?? "");
  if (inviteError && !alreadyRegistered) {
    console.error("Waitlist invite error:", inviteError);
    return { success: false, error: `The invite email could not be sent: ${inviteError.message}` };
  }

  const { data, error } = await supabase.from("waitlist").update({ status: "invited", invited_at: new Date().toISOString() }).eq("id", entry.id).neq("status", "invited").select("id");
  if (error || !data?.length) {
    console.error("Waitlist update error:", error);
    return { success: false, error: error?.message ?? "The invite was sent, but the entry could not be marked as invited. Refresh and check." };
  }

  revalidatePath("/operator/review");
  return {
    success: true,
    message: alreadyRegistered ? `${entry.email} already has an account. They are approved and can sign in now.` : `Invite email sent to ${entry.email}.`,
  };
}
