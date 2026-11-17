"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CONSENT_VERSION, USER_ROLES, consumeAuthIntent, destinationForRole, getOrigin, getProfile, safeNextPath, setAuthIntent } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type AuthActionResult = { success: true } | { success: false; error: string; retryAfter?: number };

const AGE_GATE_ERROR = "Please confirm that you are at least 18 and accept the Terms of Service and Privacy Notice.";
const TEN_MINUTES = 10 * 60 * 1000;

// AU-8: the age gate is enforced here as well as in the UI, so it cannot be bypassed.
const consentSchema = z.object({
  ageConfirmed: z.literal(true, AGE_GATE_ERROR),
  marketingOptIn: z.boolean(),
  next: z.string().nullable(),
  flag: z.object({ startupId: z.uuid(), campaign: z.string().nullable() }).nullish(),
});

const magicLinkSchema = consentSchema.extend({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
});

export async function requestMagicLink(input: unknown): Promise<AuthActionResult> {
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const { email, marketingOptIn, next, flag } = parsed.data;

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limits = [rateLimit(`magic:email:${email}`, 3, TEN_MINUTES), rateLimit(`magic:ip:${ip}`, 10, TEN_MINUTES)];
  const blocked = limits.find((limit) => !limit.allowed);
  if (blocked) {
    return { success: false, error: "Too many sign-in links requested. Please wait a few minutes and try again.", retryAfter: blocked.retryAfter };
  }

  await setAuthIntent({ marketingOptIn, next: safeNextPath(next), flag });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await getOrigin()}/auth/callback` },
  });

  if (error) {
    if (error.status === 429) {
      return { success: false, error: "A sign-in link was sent recently. Please wait a minute before requesting another.", retryAfter: 60 };
    }
    console.error("Magic link error:", error);
    return { success: false, error: "We couldn't send your sign-in link. Please try again." };
  }

  return { success: true };
}

export async function signInWithGoogle(input: unknown): Promise<AuthActionResult> {
  const parsed = consentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  await setAuthIntent({ marketingOptIn: parsed.data.marketingOptIn, next: safeNextPath(parsed.data.next), flag: parsed.data.flag });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await getOrigin()}/auth/callback` },
  });

  if (error || !data.url) {
    console.error("Google sign-in error:", error);
    return { success: false, error: "Google sign-in is unavailable right now. Please use an email link instead." };
  }

  redirect(data.url);
}

const selectRoleSchema = z.object({ role: z.enum(USER_ROLES), ageConfirmed: z.boolean(), next: z.string().nullish() });

// AU-4: first-time role selection. The age gate shows here only when no confirmation was
// recorded at sign-in (e.g. a magic link opened on a different device), and an earlier
// confirmation timestamp is kept rather than overwritten.
export async function selectRole(input: unknown): Promise<AuthActionResult> {
  const parsed = selectRoleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Choose how you will use GOAT to continue." };
  const { role, ageConfirmed } = parsed.data;
  // An investor who flagged a deal before signing up continues to that deal after choosing a role.
  const next = role === "investor" ? safeNextPath(parsed.data.next) : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (profile?.role) redirect(destinationForRole(profile.role));
  if (!profile?.age_confirmed_at && !ageConfirmed) return { success: false, error: AGE_GATE_ERROR };

  const now = new Date().toISOString();
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email,
    role,
    age_confirmed_at: profile?.age_confirmed_at ?? now,
    consent_version: CONSENT_VERSION,
    updated_at: now,
  });
  if (error) {
    console.error("Role selection error:", error);
    return { success: false, error: error.message };
  }

  redirect(next ?? destinationForRole(role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await consumeAuthIntent();
  redirect("/login");
}
