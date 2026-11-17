"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { inviteWaitlistEntry } from "@/app/actions/waitlist-admin";
import type { WaitlistRole, WaitlistStatus } from "@/lib/waitlist";

export type WaitlistItem = {
  id: string;
  email: string;
  role: WaitlistRole;
  status: WaitlistStatus;
  signedUpAt: string | null;
  invitedAt: string | null;
};

const statusStyles: Record<WaitlistStatus, string> = {
  pending: "bg-white/10 text-slate-300",
  verified: "bg-sky-400/15 text-sky-200",
  invited: "bg-emerald-400/15 text-emerald-200",
};

function InviteButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function invite() {
    setPending(true);
    setMessage(null);
    try {
      const result = await inviteWaitlistEntry({ id });
      setMessage(result.success ? { ok: true, text: result.message } : { ok: false, text: result.error });
    } catch (error) {
      console.error("Invite failed", error);
      setMessage({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={invite} disabled={pending || message?.ok === true} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-400 px-3 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
        Invite to Beta
      </button>
      {message && <p role={message.ok ? "status" : "alert"} className={`max-w-56 text-right text-[11px] leading-4 ${message.ok ? "text-emerald-300" : "text-rose-300"}`}>{message.text}</p>}
    </div>
  );
}

export function WaitlistTable({ items }: { items: WaitlistItem[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Email</th>
            <th scope="col" className="px-4 py-3 font-medium">Role</th>
            <th scope="col" className="px-4 py-3 font-medium">Signup date</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 text-right font-medium"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {items.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="break-all px-4 py-3 text-slate-100">{item.email}</td>
              <td className="px-4 py-3 capitalize text-slate-300">{item.role}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-400">{item.signedUpAt ?? "Unknown"}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusStyles[item.status]}`}>{item.status}</span>
                {item.invitedAt && <p className="mt-1 text-[11px] text-slate-500">{item.invitedAt}</p>}
              </td>
              <td className="px-4 py-3 text-right">{item.status === "invited" ? <span className="text-xs text-slate-500">Invited</span> : <InviteButton id={item.id} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
