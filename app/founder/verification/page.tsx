import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import StartupVerificationForm from "@/components/founder/startup-verification-form";
import { StatusBanner } from "@/components/investor/verification-form";
import { destinationForRole, getProfile } from "@/lib/auth";
import { STARTUP_COLUMNS, emptyStartupForm, rowToStartupForm, type StartupRow } from "@/lib/startups";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Startup verification | GOAT" };

export default async function FounderVerificationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (profile?.role !== "founder") redirect(destinationForRole(profile?.role ?? null));

  const { data: row } = await supabase.from("startups").select(STARTUP_COLUMNS).eq("owner_user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle<StartupRow>();
  const status = row?.verification_status ?? "draft";

  return (
    <AuthShell wide>
      <div className="mb-8 mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">Startup verification</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Get your startup in front of investors.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">A GOAT operator checks every company before it appears in the investor deal deck.</p>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-xs">
          <Link href="/founder/profile" className="text-slate-400 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">Founder profile</Link>
          <form action={signOut}>
            <button type="submit" className="text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">Sign out</button>
          </form>
        </div>
      </div>

      {status === "pending_review" && row && (
        <StatusBanner tone="review" title="Submission In Review">
          <p>{row.name} is in the operator review queue. It is not visible to investors until it is approved.</p>
        </StatusBanner>
      )}
      {status === "verified" && row && (
        <StatusBanner tone="verified" title="Startup Verified">
          <p>{row.name} is verified and eligible for the investor deal deck.</p>
        </StatusBanner>
      )}
      {(status === "draft" || status === "rejected") && (
        <StartupVerificationForm userId={user.id} initialValues={row ? rowToStartupForm(row) : emptyStartupForm} reviewerNotes={row?.reviewer_notes ?? null} wasRejected={status === "rejected"} />
      )}
    </AuthShell>
  );
}
