import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { legalContent, type LegalDocument } from "@/lib/legal";

export function generateStaticParams() {
  return Object.keys(legalContent).map((document) => ({ document }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[document]">): Promise<Metadata> {
  const { document } = await params;
  return { title: `${legalContent[document as LegalDocument]?.title ?? "Legal"} | GOAT` };
}

export default async function LegalPage({ params }: PageProps<"/legal/[document]">) {
  const { document } = await params;
  const content = legalContent[document as LegalDocument];
  if (!content) notFound();

  return (
    <AuthShell wide>
      <article className="mt-6 rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-black/40 sm:p-8">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">GOAT Deal Flow</p>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{content.title}</h1>
        <div className="mt-6 space-y-4 text-sm leading-6 text-slate-400">{content.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
      </article>
    </AuthShell>
  );
}
