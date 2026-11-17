import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import MessageThread from "@/components/cofounders/message-thread";
import { INTEREST_COLUMNS, MESSAGE_COLUMNS, type InterestRow, type MessageRow } from "@/lib/cofounders";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conversation | GOAT" };

const lockedMessages: Record<Exclude<InterestRow["status"], "accepted">, string> = {
  pending: "Messaging opens once this interest has been accepted.",
  declined: "This interest was declined, so there is no conversation.",
  withdrawn: "This interest was withdrawn, so there is no conversation.",
};

export default async function MessagesPage({ params }: PageProps<"/messages/[matchId]">) {
  const { matchId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(matchId)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/messages/${matchId}`)}`);

  // Row-level security only returns the interest to its two participants; anyone else gets a 404.
  const { data: interest } = await supabase.from("cofounder_interests").select(INTEREST_COLUMNS).eq("id", matchId).maybeSingle<InterestRow>();
  if (!interest) notFound();

  const otherId = interest.from_user_id === user.id ? interest.to_user_id : interest.from_user_id;
  const { data: other } = await supabase.from("cofounder_profiles").select("name, headline").eq("user_id", otherId).maybeSingle<{ name: string; headline: string | null }>();
  const otherName = other?.name || "This founder";

  // IN-2 / IN-3: messages are only loaded for an accepted interest (the database refuses otherwise too).
  const messages = interest.status === "accepted"
    ? (await supabase.from("messages").select(MESSAGE_COLUMNS).eq("match_id", matchId).order("created_at", { ascending: true }).limit(500).overrideTypes<MessageRow[]>()).data ?? []
    : [];

  return (
    <AuthShell wide>
      <div className="mb-6 mt-4">
        <Link href="/cofounders" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-emerald-300"><ArrowLeft size={13} />Back to co-founders</Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">{otherName}</h1>
        {other?.headline && <p className="mt-1 text-sm text-slate-400">{other.headline}</p>}
      </div>

      {interest.status === "accepted" ? (
        <MessageThread matchId={matchId} viewerId={user.id} otherName={otherName} initialMessages={messages} />
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900 p-6">
          <Lock size={18} className="mt-0.5 shrink-0 text-slate-500" />
          <div>
            <p className="text-sm font-semibold text-white">This conversation is not open</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">{lockedMessages[interest.status]}</p>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
