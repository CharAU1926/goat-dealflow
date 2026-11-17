import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getProfile, type ProfileRow } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type InvestorSession = { supabase: SupabaseClient; user: User; profile: ProfileRow };

/** For Server Actions: the signed-in investor, or null. Never trust a client-supplied identity. */
export async function getInvestorSession(): Promise<InvestorSession | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await getProfile(supabase, user.id);
  if (!profile?.age_confirmed_at || profile.role !== "investor") return null;
  return { supabase, user, profile };
}

/** For pages: redirects signed-out users to login and everyone else to their own home. */
export async function requireInvestorPage(next: string): Promise<InvestorSession> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const profile = await getProfile(supabase, user.id);
  if (!profile?.role) redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  if (profile.role !== "investor") redirect(profile.role === "operator" ? "/operator/review" : "/founder/profile");
  return { supabase, user, profile };
}
