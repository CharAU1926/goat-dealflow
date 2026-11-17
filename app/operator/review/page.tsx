import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { FounderCard, InvestorCard, StartupCard, type FounderQueueItem, type InvestorQueueItem, type StartupQueueItem } from "@/components/operator/review-cards";
import { getProfile, type ProfileRow } from "@/lib/auth";
import { COMPANY_TYPE_LABELS, isHttpUrl, isLinkedInProfileUrl, type CofounderProfileRow } from "@/lib/founder-profile";
import { INVESTOR_PROFILE_COLUMNS, INVESTOR_TYPE_LABELS, type InvestorProfileRow } from "@/lib/investor-verification";
import { COMPANY_TYPE_OPTIONS, STARTUP_COLUMNS, STARTUP_EVIDENCE, formatFunding, stageLabel, type StartupRow } from "@/lib/startups";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Operator review | GOAT" };

type Contact = Pick<ProfileRow, "id" | "email" | "full_name">;

// Rendered on the server so the timestamp text is identical on both sides (no hydration drift).
const formatDate = (value: string | null) => (value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Nicosia" }).format(new Date(value)) : null);

export default async function OperatorReviewPage({ searchParams }: PageProps<"/operator/review">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Strict gate: anyone who is not an operator is sent to the public home page.
  const profile = await getProfile(supabase, user.id);
  if (profile?.role !== "operator") redirect("/");

  const requestedTab = (await searchParams).tab;
  const tab = requestedTab === "founders" || requestedTab === "startups" ? requestedTab : "investors";

  const [investorQueue, founderQueue, startupQueue] = await Promise.all([
    supabase.from("investor_profiles").select(INVESTOR_PROFILE_COLUMNS).eq("verification_status", "pending_review").order("submitted_at", { ascending: true }).overrideTypes<InvestorProfileRow[]>(),
    supabase.from("cofounder_profiles").select("*").eq("visibility_status", "pending_review").order("submitted_at", { ascending: true }).overrideTypes<CofounderProfileRow[]>(),
    supabase.from("startups").select(STARTUP_COLUMNS).eq("verification_status", "pending_review").order("submitted_at", { ascending: true }).overrideTypes<StartupRow[]>(),
  ]);
  const queueError = investorQueue.error ?? founderQueue.error ?? startupQueue.error;
  if (queueError) console.error("Operator queue error:", queueError);
  const investors = investorQueue.data ?? [];
  const founders = founderQueue.data ?? [];
  const startups = startupQueue.data ?? [];

  const userIds = [...investors.map((row) => row.user_id), ...founders.map((row) => row.user_id), ...startups.map((row) => row.owner_user_id)];
  const { data: contactRows } = userIds.length > 0 ? await supabase.from("profiles").select("id, email, full_name").in("id", userIds).overrideTypes<Contact[]>() : { data: [] };
  const contacts = new Map((contactRows ?? []).map((contact) => [contact.id, contact]));

  const investorItems: InvestorQueueItem[] = investors.map((row) => ({
    userId: row.user_id,
    name: contacts.get(row.user_id)?.full_name || "Name not provided",
    email: contacts.get(row.user_id)?.email ?? "Email unavailable",
    typeLabel: (row.investor_type ? INVESTOR_TYPE_LABELS[row.investor_type] : "Investor"),
    firm: row.firm,
    title: row.title,
    regulatedAuthority: row.evidence?.regulatedAuthority ?? null,
    fundsStudentCompanies: row.funds_student_companies,
    // Applicant-supplied URLs are re-checked here so only http(s) links ever become clickable.
    links: (row.evidence?.capTableLinks ?? []).filter((link) => isHttpUrl(link)),
    evidenceFilePath: row.evidence_file_path,
    submittedAt: formatDate(row.submitted_at),
  }));

  const founderItems: FounderQueueItem[] = founders.map((row) => ({
    userId: row.user_id,
    name: row.name || contacts.get(row.user_id)?.full_name || "Name not provided",
    email: contacts.get(row.user_id)?.email ?? "Email unavailable",
    headline: row.headline ?? "",
    bio: row.bio ?? "",
    skills: row.skills ?? [],
    companyTypeLabel: row.company_type === "student" || row.company_type === "registered" ? COMPANY_TYPE_LABELS[row.company_type] : "Company type not set",
    linkedinUrl: row.linkedin_url && isLinkedInProfileUrl(row.linkedin_url) ? row.linkedin_url : null,
    submittedAt: formatDate(row.submitted_at),
  }));

  const startupItems: StartupQueueItem[] = startups.map((row) => ({
    startupId: row.id,
    founderName: contacts.get(row.owner_user_id)?.full_name || "Name not provided",
    founderEmail: contacts.get(row.owner_user_id)?.email ?? "Email unavailable",
    name: row.name,
    oneLiner: row.one_liner,
    companyTypeLabel: row.company_type ? COMPANY_TYPE_OPTIONS[row.company_type] : "Company type not set",
    details: [
      ["Sector", (row.sectors ?? []).join(", ") || "Not provided"],
      ["Stage", stageLabel(row.stage)],
      ["Location", row.location ?? "Not provided"],
      ["Funding target", formatFunding(row.funding_sought)],
      ["Traction signal", row.traction_signal ?? "Not provided"],
      ...(row.company_type === "registered"
        ? ([["Legal name", row.legal_name ?? "Not provided"], ["Registration number", row.registration_number ?? "Not provided"], ["Country", row.registration_country ?? "Not provided"]] satisfies [string, string][])
        : []),
      ["Declarations", row.safe_claims_declared_at && row.active_raise_confirmed_at ? "Safe claims and active raise confirmed" : "Missing"],
    ],
    evidenceLabel: row.company_type ? STARTUP_EVIDENCE[row.company_type].label : "Evidence",
    evidenceFilePath: row.evidence_file_path,
    submittedAt: formatDate(row.submitted_at),
  }));

  const tabs = [
    { key: "investors", label: "Pending Investors", count: investorItems.length, href: "/operator/review" },
    { key: "founders", label: "Pending Founders", count: founderItems.length, href: "/operator/review?tab=founders" },
    { key: "startups", label: "Pending Startups", count: startupItems.length, href: "/operator/review?tab=startups" },
  ] as const;
  const isEmpty = tabs.find(({ key }) => key === tab)?.count === 0;

  return (
    <AuthShell wide>
      <div className="mb-8 mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">Operator console</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Review queue</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Every decision is recorded in the audit log under your account.</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="text-xs text-slate-500 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-emerald-300">Sign out</button>
        </form>
      </div>

      <nav aria-label="Review queues" className="mb-5 grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-slate-900/70 p-1">
        {tabs.map(({ key, label, count, href }) => (
          <Link key={key} href={href} aria-current={tab === key ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2.5 text-center text-xs font-medium transition-colors sm:flex-row sm:gap-2 ${tab === key ? "bg-slate-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>
            {label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${count > 0 ? "bg-emerald-400 font-semibold text-slate-950" : "bg-white/10 text-slate-400"}`}>{count}</span>
          </Link>
        ))}
      </nav>

      {queueError && <p role="alert" className="mb-5 rounded-xl border border-rose-300/25 bg-rose-300/5 p-4 text-sm text-rose-100">The queue could not be loaded: {queueError.message}</p>}

      <div className="space-y-5">
        {tab === "investors" && investorItems.map((item) => <InvestorCard key={item.userId} item={item} />)}
        {tab === "founders" && founderItems.map((item) => <FounderCard key={item.userId} item={item} />)}
        {tab === "startups" && startupItems.map((item) => <StartupCard key={item.startupId} item={item} />)}
        {isEmpty && !queueError && <p className="rounded-2xl border border-white/10 bg-slate-900 p-8 text-center text-sm text-slate-500">Nothing is waiting for review in this queue.</p>}
      </div>
    </AuthShell>
  );
}
