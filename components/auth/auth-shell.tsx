import Link from "next/link";

export function AuthShell({ children, wide = false, full = false }: { children: React.ReactNode; wide?: boolean; full?: boolean }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-slate-950 text-slate-100 selection:bg-emerald-400 selection:text-slate-950">
      <div className="pointer-events-none fixed inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />
      <header className="relative z-10 mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-12">
        <Link href="/" className="inline-flex items-center gap-3" aria-label="GOAT home">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400 text-lg font-black italic text-slate-950">G</span>
          <span className="text-lg font-bold tracking-[0.18em] text-white">GOAT</span>
          <span className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">Beta</span>
        </Link>
      </header>
      <main className={`relative z-10 mx-auto flex w-full flex-1 flex-col px-5 pb-16 sm:px-8 ${full ? "max-w-7xl lg:px-12" : wide ? "max-w-3xl" : "max-w-md justify-center"}`}>{children}</main>
    </div>
  );
}

export function ConsentCheckbox({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (checked: boolean) => void; children: React.ReactNode }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-400">
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 bg-slate-950 accent-emerald-400" />
      <span>{children}</span>
    </label>
  );
}

export function AgeGateLabel() {
  const linkClass = "text-slate-200 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-emerald-300";
  return (
    <>
      I confirm that I am at least 18 years of age and accept the{" "}
      <Link href="/legal/terms" target="_blank" className={linkClass}>Terms of Service</Link> and{" "}
      <Link href="/legal/privacy" target="_blank" className={linkClass}>Privacy Notice</Link>.
    </>
  );
}
