"use server";

import { createClient } from "@supabase/supabase-js";

const blockedConsumerDomains = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "live.com",
  "aol.com",
  "proton.me",
  "zoho.com",
]);

type JoinWaitlistInput = {
  email: string;
  role: string;
};

type JoinWaitlistResult =
  | { success: true; message?: string }
  | { success: false; error: string };

export async function joinWaitlist(
  formData: JoinWaitlistInput
): Promise<JoinWaitlistResult> {
  const email = formData.email.trim().toLowerCase();
  const emailDomain = email.split("@").pop();

  if (emailDomain && blockedConsumerDomains.has(emailDomain)) {
    return {
      success: false,
      error:
        "Please use your work or company email. Personal webmail is not accepted.",
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const error =
      "Supabase configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and a Supabase key.";
    console.error("Supabase waitlist error:", error);
    return { success: false, error };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { error } = await supabase.from("waitlist").insert({
    email,
    role: formData.role,
    source: "landing_page",
    campaign: "organic",
    consent_version: "v1.0",
  });

  if (error) {
    console.error("Supabase waitlist error:", error);
    if (error.code === "23505") {
      return { success: true, message: "You are already on the priority list!" };
    }
    return { success: false, error: error.message };
  }

  return { success: true };
}
