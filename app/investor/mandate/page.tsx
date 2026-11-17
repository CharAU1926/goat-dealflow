import type { Metadata } from "next";
import { signOut } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { InvestorNav } from "@/components/investor/investor-nav";
import MandateForm from "@/components/investor/mandate-form";
import { requireInvestorPage } from "@/lib/investor-session";
import { MANDATE_COLUMNS, rowToMandateForm, type MandateRow } from "@/lib/mandate";

export const metadata: Metadata = { title: "Investor mandate | GOAT" };

export default async function InvestorMandatePage() {
  const { supabase, user } = await requireInvestorPage("/investor/mandate");
  const { data: row } = await supabase.from("investor_profiles").select(MANDATE_COLUMNS).eq("user_id", user.id).maybeSingle<MandateRow>();

  return (
    <AuthShell wide>
      <div className="mb-2 mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">Investor mandate</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">What are you looking for?</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Set the sectors, stages, geography and cheque size you invest in. Your mandate is private to you.</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="text-xs text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">Sign out</button>
        </form>
      </div>
      <InvestorNav current="/investor/mandate" />
      <MandateForm initialValues={rowToMandateForm(row)} fundsStudentCompanies={row?.funds_student_companies ?? false} />
    </AuthShell>
  );
}
