import { cookies, headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const USER_ROLES = ["founder", "investor"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CONSENT_VERSION = "v1.6";

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  // "operator" exists in the database enum but can never be self-selected.
  role: UserRole | "operator" | null;
  age_confirmed_at: string | null;
  consent_version: string | null;
  marketing_opt_in: boolean;
  marketing_opt_in_at: string | null;
};

const PROFILE_COLUMNS = "id, email, full_name, role, age_confirmed_at, consent_version, marketing_opt_in, marketing_opt_in_at";

export function destinationForRole(role: ProfileRow["role"]) {
  if (role === "founder") return "/founder/profile";
  if (role === "investor") return "/investor/verification";
  if (role === "operator") return "/operator/review";
  return "/onboarding";
}

/** Only same-site paths are allowed as post-login destinations (no open redirects). */
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}

export async function getOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin) return origin;
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function getProfile(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle<ProfileRow>();
  return data;
}

// Consent given on the login screen has to survive the OAuth / magic-link round trip,
// so it is parked in a short-lived httpOnly cookie and written to `profiles` on return.
const AUTH_INTENT_COOKIE = "goat_auth_intent";

const authIntentSchema = z.object({
  ageConfirmedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  marketingOptIn: z.boolean(),
  next: z.string().nullable(),
  // AU-2 / AU-3: a deal flagged before sign-in, saved for the user once they are authenticated.
  flag: z.object({ startupId: z.uuid(), campaign: z.string().nullable() }).nullish(),
});

type AuthIntent = z.infer<typeof authIntentSchema>;

export async function setAuthIntent(intent: Omit<AuthIntent, "ageConfirmedAt">) {
  const cookieStore = await cookies();
  const value: AuthIntent = { ...intent, ageConfirmedAt: new Date().toISOString() };
  cookieStore.set(AUTH_INTENT_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
}

/** Reads and clears the pending login intent. Only call from a Route Handler or Server Action. */
export async function consumeAuthIntent(): Promise<AuthIntent | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_INTENT_COOKIE)?.value;
  if (!raw) return null;
  cookieStore.delete(AUTH_INTENT_COOKIE);
  try {
    const parsed = authIntentSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Ensures the user has a `profiles` row and records any pending consent on it.
 * The first age confirmation is kept, and marketing consent is only ever switched on here.
 */
export async function syncProfile(supabase: SupabaseClient, user: { id: string; email?: string }, intent: AuthIntent | null) {
  const existing = await getProfile(supabase, user.id);
  const patch: Partial<ProfileRow> = {};

  if (intent) {
    if (!existing?.age_confirmed_at) {
      patch.age_confirmed_at = intent.ageConfirmedAt;
      patch.consent_version = CONSENT_VERSION;
    }
    if (intent.marketingOptIn && !existing?.marketing_opt_in) {
      patch.marketing_opt_in = true;
      patch.marketing_opt_in_at = intent.ageConfirmedAt;
    }
  }

  if (existing && Object.keys(patch).length === 0) return existing;

  // New rows set role to null explicitly so the user always goes through role selection.
  const query = existing
    ? supabase.from("profiles").update(patch).eq("id", user.id)
    : supabase.from("profiles").insert({ id: user.id, email: user.email, role: null, ...patch });
  const { data, error } = await query.select(PROFILE_COLUMNS).single<ProfileRow>();
  if (error) {
    console.error("Profile sync failed:", error);
    return existing;
  }
  return data;
}
