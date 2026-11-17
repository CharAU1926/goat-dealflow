import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import FounderProfileForm from "@/components/founder/profile-form";
import { destinationForRole, getProfile } from "@/lib/auth";
import { emptyFounderProfile, rowToFounderProfile, type CofounderProfileRow } from "@/lib/founder-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Founder profile | GOAT" };

export default async function FounderProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (profile?.role !== "founder") redirect(destinationForRole(profile?.role ?? null));

  const { data: row } = await supabase.from("cofounder_profiles").select("*").eq("user_id", user.id).maybeSingle<CofounderProfileRow>();
  const initialValues = row ? rowToFounderProfile(row) : { ...emptyFounderProfile, fullName: profile.full_name ?? "" };

  return (
    <AuthShell wide>
      <div className="mb-8 mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">Founder profile</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Tell us who you are building with.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Complete every required section to submit your profile for review. You can save a draft at any point.</p>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-xs">
          <Link href="/cofounders" className="text-slate-400 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">Find co-founders</Link>
          <Link href="/founder/verification" className="text-slate-400 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">Startup verification</Link>
          <form action={signOut}>
            <button type="submit" className="text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">Sign out</button>
          </form>
        </div>
      </div>
      {row?.reviewer_notes && row.visibility_status === "draft" && (
        <div className="mb-5 rounded-2xl border border-amber-300/25 bg-amber-300/5 p-5 text-sm leading-6 text-amber-100">
          <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Changes requested by the GOAT team</p>
          <p className="mt-1">{row.reviewer_notes}</p>
        </div>
      )}
      <FounderProfileForm initialValues={initialValues} initialStatus={row?.visibility_status ?? "draft"} email={user.email ?? ""} emailVerified={Boolean(user.email_confirmed_at)} />
    </AuthShell>
  );
}
