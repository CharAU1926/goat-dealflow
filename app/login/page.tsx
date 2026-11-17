import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import LoginForm from "@/components/auth/login-form";
import { destinationForRole, getProfile, safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in | GOAT" };

const errorMessages: Record<string, string> = {
  link: "That sign-in link is invalid or has expired. Request a new one below.",
  auth: "We couldn't sign you in. Please try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const errorCode = typeof params.error === "string" ? params.error : "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const profile = await getProfile(supabase, user.id);
    redirect(destinationForRole(profile?.role ?? null));
  }

  return (
    <AuthShell>
      <LoginForm next={next} initialError={errorMessages[errorCode] ?? ""} />
      <p className="mt-6 text-center text-xs leading-5 text-slate-600">GOAT is an introductions and software workflow platform. It does not provide investment advice.</p>
    </AuthShell>
  );
}
