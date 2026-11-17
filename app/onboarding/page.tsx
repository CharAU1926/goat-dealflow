import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import RoleSelection from "@/components/auth/role-selection";
import { destinationForRole, getProfile, safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose your role | GOAT" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (profile?.role) redirect(destinationForRole(profile.role));

  return (
    <AuthShell>
      <RoleSelection needsAgeConfirmation={!profile?.age_confirmed_at} next={safeNextPath(typeof next === "string" ? next : null)} />
    </AuthShell>
  );
}
