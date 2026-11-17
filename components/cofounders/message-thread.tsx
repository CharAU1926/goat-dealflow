"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { sendMessage } from "@/app/actions/cofounders";
import { MESSAGE_MAX_LENGTH, formatMessageTime, type MessageRow } from "@/lib/cofounders";
import { createClient } from "@/lib/supabase/client";

type MessageThreadProps = { matchId: string; viewerId: string; otherName: string; initialMessages: MessageRow[] };

export default function MessageThread({ matchId, viewerId, otherName, initialMessages }: MessageThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [isLive, setIsLive] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  // A message can arrive twice (from the send response and from Realtime), so it is added once by id.
  function append(message: MessageRow) {
    setMessages((current) => (current.some((existing) => existing.id === message.id) ? current : [...current, message]));
  }

  // Realtime applies the same database rules as reads: only the two matched founders receive these.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${matchId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, (payload) => append(payload.new as MessageRow))
      .subscribe((status) => setIsLive(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;

    setError("");
    setIsSending(true);
    try {
      const response = await sendMessage({ matchId, content });
      if (!response.success) return setError(response.error);
      append(response.message);
      setDraft("");
    } catch (caught) {
      console.error("Send message failed", caught);
      setError("Your message was not sent. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="flex min-h-[60vh] flex-col rounded-2xl border border-white/10 bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <span>Private conversation</span>
        <span className={`flex items-center gap-1.5 ${isLive ? "text-emerald-400" : "text-slate-600"}`}><span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-400" : "bg-slate-600"}`} />{isLive ? "Live" : "Connecting"}</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-5" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-slate-500">You and {otherName} are connected. Say hello.</p>}
        {messages.map((message) => {
          const isMine = message.sender_id === viewerId;
          return (
            <div key={message.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
              <p className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-6 ${isMine ? "rounded-br-md bg-emerald-400 text-slate-950" : "rounded-bl-md bg-slate-800 text-slate-100"}`}>{message.content}</p>
              <span className="mt-1 text-[10px] text-slate-600">{isMine ? "You" : otherName} · {formatMessageTime(message.created_at)}</span>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-white/10 p-4">
        <div className="flex items-end gap-2">
          <label htmlFor="message" className="sr-only">Message</label>
          <textarea id="message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={2} maxLength={MESSAGE_MAX_LENGTH} placeholder={`Message ${otherName}`} className="min-h-12 flex-1 resize-none rounded-lg border border-white/10 bg-slate-950/60 px-3 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-400/60" />
          <button type="submit" disabled={isSending || !draft.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">
            {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
      </form>
    </section>
  );
}
