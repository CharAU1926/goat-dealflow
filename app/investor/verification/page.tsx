import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { InvestorNav } from "@/components/investor/investor-nav";
import InvestorVerificationForm, { StatusBanner } from "@/components/investor/verification-form";
import { destinationForRole, getProfile } from "@/lib/auth";
import { INVESTOR_PROFILE_COLUMNS, INVESTOR_TYPE_LABELS, IN_REVIEW_MESSAGE, IV2_BOUNDARY, VERIFIED_MESSAGE, emptyInvestorForm, rowToInvestorForm, type InvestorProfileRow } from "@/lib/investor-verification";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Investor verification | GOAT" };

export default async function InvestorVerificationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (profile?.role !== "investor") redirect(destinationForRole(profile?.role ?? null));

  const { data: row } = await supabase.from("investor_profiles").select(INVESTOR_PROFILE_COLUMNS).eq("user_id", user.id).maybeSingle<InvestorProfileRow>();
  const status = row?.verification_status ?? "draft";

  return (
    <AuthShell wide>
      <div className="mb-8 mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">Investor verification</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Confirm your investor status.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Tell us what kind of investor you are and give us something we can check. A GOAT operator reviews every application.</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="text-xs text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">Sign out</button>
        </form>
      </div>

      <InvestorNav current="/investor/verification" />

      <div className="space-y-5">
        {status === "pending_review" && row && (
          <StatusBanner tone="review" title="Application In Review">
            <p>{IN_REVIEW_MESSAGE}</p>
            <p className="mt-2 text-xs text-slate-500">Submitted as {(row.investor_type ? INVESTOR_TYPE_LABELS[row.investor_type] : "Investor")}{row.firm ? ` · ${row.firm}` : ""}{row.evidence_file_path ? " · Evidence document on file" : ""}</p>
          </StatusBanner>
        )}
        {status === "verified" && row && (
          <StatusBanner tone="verified" title={VERIFIED_MESSAGE}>
            <p>Verified as {(row.investor_type ? INVESTOR_TYPE_LABELS[row.investor_type] : "Investor")}. Confidential pitch decks, financial metrics and founder contact are unlocked for your account.</p>
          </StatusBanner>
        )}

        {status !== "verified" && (
          <div className="flex items-start gap-3 rounded-2xl border border-indigo-400/20 bg-indigo-400/5 p-5">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-indigo-300" />
            <div>
              <p className="text-sm font-semibold text-white">What verification unlocks</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">{IV2_BOUNDARY}</p>
            </div>
          </div>
        )}

        {(status === "draft" || status === "rejected") && (
          <InvestorVerificationForm userId={user.id} initialValues={row ? rowToInvestorForm(row) : emptyInvestorForm} reviewerNotes={row?.reviewer_notes ?? null} wasRejected={status === "rejected"} />
        )}
      </div>
    </AuthShell>
  );
}
