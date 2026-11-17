import { z } from "zod";

// Values mirror the check constraint on `public.saved_deals.pipeline_status` (SD-1).
export const PIPELINE_STATUSES = ["saved", "reviewing", "contacted", "passed", "invested"] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];
export const PIPELINE_LABELS: Record<PipelineStatus, string> = { saved: "Saved", reviewing: "Reviewing", contacted: "Contacted", passed: "Passed", invested: "Invested / Closed" };

export const NOTES_MAX = 4000;

export type SavedDealRow = {
  id: string;
  startup_id: string;
  pipeline_status: PipelineStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
export const SAVED_DEAL_COLUMNS = "id, startup_id, pipeline_status, notes, created_at, updated_at";

export const updateSavedDealSchema = z
  .object({
    id: z.uuid(),
    pipelineStatus: z.enum(PIPELINE_STATUSES).optional(),
    notes: z.string().max(NOTES_MAX, `Keep notes under ${NOTES_MAX} characters.`).optional(),
  })
  .refine((value) => value.pipelineStatus !== undefined || value.notes !== undefined, "Nothing to update.");
