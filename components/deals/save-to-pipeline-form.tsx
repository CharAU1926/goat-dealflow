"use client";

import { Bookmark } from "lucide-react";
import { saveToPipeline } from "@/app/actions/pipeline";
import { notifyMeaningfulAction } from "@/lib/pwa";

export default function SaveToPipelineForm({ startupId }: { startupId: string }) {
  async function action(formData: FormData) {
    await saveToPipeline(formData);
    notifyMeaningfulAction(); // PRD v1.6 §7: offer install after the first saved deal.
  }

  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="startupId" value={startupId} />
      <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 px-4 text-xs font-semibold text-slate-200 transition-colors hover:border-emerald-400/40 hover:text-emerald-300"><Bookmark size={14} />Save to pipeline</button>
    </form>
  );
}
