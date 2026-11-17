import Link from "next/link";

const LINKS = [
  { href: "/pipeline", label: "Pipeline" },
  { href: "/investor/mandate", label: "Mandate" },
  { href: "/investor/verification", label: "Verification" },
] as const;

export function InvestorNav({ current }: { current: (typeof LINKS)[number]["href"] | null }) {
  return (
    <nav aria-label="Investor workspace" className="mb-6 mt-2 flex flex-wrap gap-2">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} aria-current={link.href === current ? "page" : undefined} className={`inline-flex min-h-9 items-center rounded-lg border px-3 text-xs font-medium transition-colors ${link.href === current ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-slate-400 hover:border-white/20 hover:text-white"}`}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
