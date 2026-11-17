import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import StartupProfileForm from "@/components/founder/startup-profile-form";
import { StatusBanner } from "@/components/investor/verification-form";
import { destinationForRole, getProfile } from "@/lib/auth";
import { STARTUP_COLUMNS, emptyStartupProfile, rowToStartupProfile, type StartupRow } from "@/lib/startups";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Startup profile | GOAT" };

// The profile fields that are not part of `STARTUP_COLUMNS`.
const PROFILE_COLUMNS = `${STARTUP_COLUMNS}, description, use_of_funds, website, pitch_deck_url`;
type ProfileRow = StartupRow & { description: string | null; use_of_funds: string | null; website: string | null; pitch_deck_url: string | null };

export default async function FounderStartupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (profile?.role !== "founder") redirect(destinationForRole(profile?.role ?? null));

  const { data: row } = await supabase.from("startups").select(PROFILE_COLUMNS).eq("owner_user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle<ProfileRow>();
  const status = row?.verification_status ?? "draft";

  return (
    <AuthShell wide>
      <div className="mb-8 mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">Startup profile</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Tell investors about your startup.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">This is separate from your co-founder profile. Complete every required field to submit it to the GOAT operator review queue. You can save a draft at any point.</p>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-xs">
          <Link href="/founder/profile" className="text-slate-400 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">Founder profile</Link>
          <form action={signOut}>
            <button type="submit" className="text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">Sign out</button>
          </form>
        </div>
      </div>

      {status === "verified" && row ? (
        <StatusBanner tone="verified" title="Startup Verified">
          <p>{row.name} is verified and eligible for the investor deal deck. A verified startup can only be changed by the GOAT team.</p>
        </StatusBanner>
      ) : (
        <StartupProfileForm userId={user.id} initialValues={row ? rowToStartupProfile(row) : emptyStartupProfile} initialStatus={status === "pending_review" || status === "rejected" ? status : "draft"} reviewerNotes={row?.reviewer_notes ?? null} />
      )}
    </AuthShell>
  );
}
