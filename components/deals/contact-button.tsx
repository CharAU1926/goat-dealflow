"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { contactCompany } from "@/app/actions/contact";

// IN-1: logs the click, then opens the introduction e-mail. The address is only ever returned
// by the server after it has verified the caller, so it is not present in the page itself.
export default function ContactButton({ startupId, disabled }: { startupId: string; disabled?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setError("");
    setPending(true);
    try {
      const result = await contactCompany({ startupId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      window.location.href = result.mailto;
    } catch (contactError) {
      console.error("Contact company failed", contactError);
      setError("We couldn't open the introduction. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={disabled || pending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
        Contact Company
      </button>
      {disabled && <p className="mt-2 text-xs text-slate-500">This company hasn&apos;t shared a contact address yet.</p>}
      {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
