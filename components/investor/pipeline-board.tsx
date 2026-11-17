"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Mail, Search, Trash2 } from "lucide-react";
import { removeSavedDeal, updateSavedDeal } from "@/app/actions/pipeline";
import { NOTES_MAX, PIPELINE_LABELS, PIPELINE_STATUSES, type PipelineStatus } from "@/lib/pipeline";
import { STAGE_LABELS, formatFunding, stageLabel } from "@/lib/startups";

export type PipelineItem = {
  id: string;
  startupId: string;
  status: PipelineStatus;
  notes: string;
  name: string;
  oneLiner: string;
  sectors: string[];
  stage: string | null;
  fundingSought: number | null;
  available: boolean;
  introRequested: boolean;
};

const inputClass = "min-h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-400/60";

export default function PipelineBoard({ initialItems }: { initialItems: PipelineItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (stage && item.stage !== stage) return false;
      if (!needle) return true;
      return [item.name, item.oneLiner, item.notes, ...item.sectors].some((field) => field.toLowerCase().includes(needle));
    });
  }, [items, query, stage]);

  const patch = (id: string, changes: Partial<PipelineItem>) => setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));

  async function move(item: PipelineItem, status: PipelineStatus) {
    if (status === item.status) return;
    const previous = item.status;
    setError("");
    patch(item.id, { status });
    const result = await updateSavedDeal({ id: item.id, pipelineStatus: status }).catch(() => ({ success: false as const, error: "We couldn't move this deal. Please try again." }));
    if (!result.success) {
      patch(item.id, { status: previous });
      setError(result.error);
    }
  }

  async function remove(item: PipelineItem) {
    setError("");
    const result = await removeSavedDeal({ id: item.id }).catch(() => ({ success: false as const, error: "We couldn't remove this deal. Please try again." }));
    if (result.success) setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    else setError(result.error);
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
        <p className="text-sm font-semibold text-white">No saved deals yet</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">Flag a company in the deal deck and it will appear here, ready to review.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, sector or notes" aria-label="Search saved deals" className={`${inputClass} w-full pl-9`} />
        </div>
        <select value={stage} onChange={(event) => setStage(event.target.value)} aria-label="Filter by stage" className={`${inputClass} sm:w-44`}>
          <option value="" className="bg-slate-900">All stages</option>
          {Object.entries(STAGE_LABELS).map(([value, label]) => <option key={value} value={value} className="bg-slate-900">{label}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="mb-4 text-xs text-rose-300">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {PIPELINE_STATUSES.map((status) => {
          const column = visible.filter((item) => item.status === status);
          return (
            <section key={status} aria-labelledby={`col-${status}`} className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
              <h2 id={`col-${status}`} className="mb-3 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {PIPELINE_LABELS[status]}
                <span className="rounded-md bg-white/6 px-2 py-0.5 text-[10px] text-slate-300">{column.length}</span>
              </h2>
              <div className="space-y-3">
                {column.map((item) => <DealCard key={item.id} item={item} onMove={(next) => move(item, next)} onRemove={() => remove(item)} onNotesSaved={(notes) => patch(item.id, { notes })} />)}
                {column.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-600">Empty</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DealCard({ item, onMove, onRemove, onNotesSaved }: { item: PipelineItem; onMove: (status: PipelineStatus) => void; onRemove: () => void; onNotesSaved: (notes: string) => void }) {
  const [draft, setDraft] = useState(item.notes);
  const [saving, setSaving] = useState(false);
  const [noteError, setNoteError] = useState("");
  const dirty = draft !== item.notes;

  async function saveNotes() {
    setSaving(true);
    setNoteError("");
    const result = await updateSavedDeal({ id: item.id, notes: draft }).catch(() => ({ success: false as const, error: "We couldn't save your notes." }));
    setSaving(false);
    if (result.success) onNotesSaved(draft);
    else setNoteError(result.error);
  }

  return (
    <article className="rounded-xl border border-white/10 bg-slate-900 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-white">{item.name}</h3>
          {item.oneLiner && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.oneLiner}</p>}
        </div>
        {item.available && <Link href={`/deals/${item.startupId}`} aria-label={`Open ${item.name}`} className="shrink-0 text-slate-500 transition-colors hover:text-emerald-300"><ArrowUpRight size={16} /></Link>}
      </div>

      {item.available && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] text-slate-300">
          <span className="rounded bg-indigo-400/10 px-1.5 py-0.5 text-indigo-200">{stageLabel(item.stage)}</span>
          <span className="rounded bg-white/6 px-1.5 py-0.5">{formatFunding(item.fundingSought)}</span>
          {item.sectors.map((sector) => <span key={sector} className="rounded bg-white/6 px-1.5 py-0.5">{sector}</span>)}
        </div>
      )}
      {item.introRequested && <p className="mt-2.5 flex items-center gap-1.5 text-[10px] text-slate-500"><Mail size={11} />Introduction requested</p>}

      <label className="mt-3 block text-[10px] font-medium uppercase tracking-wider text-slate-600" htmlFor={`move-${item.id}`}>Move to</label>
      <select id={`move-${item.id}`} value={item.status} onChange={(event) => onMove(event.target.value as PipelineStatus)} className="mt-1 min-h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-xs text-white outline-none focus:border-emerald-400/60">
        {PIPELINE_STATUSES.map((status) => <option key={status} value={status} className="bg-slate-900">{PIPELINE_LABELS[status]}</option>)}
      </select>

      <label className="mt-3 block text-[10px] font-medium uppercase tracking-wider text-slate-600" htmlFor={`notes-${item.id}`}>Private notes</label>
      <textarea id={`notes-${item.id}`} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={NOTES_MAX} rows={3} placeholder="Only you can see these" className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-2 text-xs leading-5 text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/60" />
      <div className="mt-2 flex items-center justify-between gap-2">
        <button type="button" onClick={onRemove} aria-label={`Remove ${item.name} from pipeline`} className="text-slate-600 transition-colors hover:text-rose-300"><Trash2 size={14} /></button>
        <div className="flex items-center gap-2">
          {noteError && <span role="alert" className="text-[10px] text-rose-300">{noteError}</span>}
          <button type="button" onClick={saveNotes} disabled={!dirty || saving} className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-[11px] text-slate-300 transition-colors hover:border-emerald-400/40 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">
            {saving && <Loader2 size={12} className="animate-spin" />}Save note
          </button>
        </div>
      </div>
    </article>
  );
}
