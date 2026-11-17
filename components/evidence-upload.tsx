"use client";

import { useRef, useState } from "react";
import { FileCheck, Loader2, Upload } from "lucide-react";
import { registerEvidenceUpload } from "@/app/actions/evidence";
import { EVIDENCE_BUCKET, EVIDENCE_MAX_BYTES, EVIDENCE_MIME_EXTENSIONS } from "@/lib/investor-verification";
import { createClient } from "@/lib/supabase/client";

type EvidenceUploadProps = {
  userId: string;
  purpose: "investor" | "startup";
  label: string;
  hint?: string;
  optional?: boolean;
  pdfOnly?: boolean;
  value: string;
  error?: string;
  onChange: (filePath: string) => void;
  onBusyChange?: (busy: boolean) => void;
};

// SEC-2 / IV-4: the file goes straight from the browser into the private bucket, inside the
// user's own folder, and is then registered for retention tracking. It never passes through
// this app's server.
export default function EvidenceUpload({ userId, purpose, label, hint, optional, pdfOnly, value, error, onChange, onBusyChange }: EvidenceUploadProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [fileName, setFileName] = useState(value ? "Document on file" : "");

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const extension = EVIDENCE_MIME_EXTENSIONS[file.type];
    if (!extension || (pdfOnly && extension !== "pdf")) return setUploadError(pdfOnly ? "Upload a PDF file." : "Upload a PDF, PNG or JPG file.");
    if (file.size > EVIDENCE_MAX_BYTES) return setUploadError("The file must be 10 MB or smaller.");

    setUploadError("");
    setIsUploading(true);
    onBusyChange?.(true);
    try {
      const path = `${userId}/${crypto.randomUUID()}.${extension}`;
      const { error: storageError } = await createClient().storage.from(EVIDENCE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (storageError) {
        console.error("Evidence upload failed", storageError);
        setUploadError(storageError.message);
        return;
      }
      const registration = await registerEvidenceUpload({ filePath: path, purpose });
      if (!registration.success) {
        setUploadError(registration.error);
        return;
      }
      setFileName(file.name);
      onChange(path);
    } catch (caught) {
      console.error("Evidence upload failed", caught);
      setUploadError("The upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      onBusyChange?.(false);
    }
  }

  const message = uploadError || error;

  return (
    <div>
      <p className="mb-2 block text-xs font-medium text-slate-400">{label}{optional && <span className="ml-1.5 font-normal text-slate-600">Optional</span>}</p>
      <input ref={fileInput} type="file" accept={pdfOnly ? ".pdf,application/pdf" : ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"} onChange={handleFile} className="sr-only" tabIndex={-1} aria-label={label} />
      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-white/15 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-xs leading-5 text-slate-400">
          {value ? <><FileCheck size={15} className="shrink-0 text-emerald-300" /><span className="break-all text-slate-200">{fileName}</span></> : `${hint ?? "PDF, PNG or JPG, up to 10 MB."} Stored privately and seen only by GOAT operators.`}
        </p>
        <button type="button" onClick={() => fileInput.current?.click()} disabled={isUploading} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-xs font-medium text-slate-200 transition-colors hover:border-white/25 hover:text-white disabled:cursor-wait disabled:opacity-50">
          {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {isUploading ? "Uploading" : value ? "Replace document" : "Upload document"}
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-rose-300">{message}</p>}
    </div>
  );
}
