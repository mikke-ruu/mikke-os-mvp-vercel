import Link from "next/link";

export function FundPublicShell({
  title = "Fund",
  backHref,
  children
}: {
  title?: string;
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--mikke-surface)] text-[var(--mikke-text)]">
      <header className="border-b border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          {backHref ? (
            <Link href={backHref} className="text-sm font-bold text-[var(--mikke-muted)]">
              ← 戻る
            </Link>
          ) : null}
          <p className="text-lg font-bold tracking-normal">{title}</p>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">{children}</div>
      <footer className="px-4 py-7 text-center text-xs font-semibold text-[var(--mikke-muted-light)]">Fund by mikke</footer>
    </main>
  );
}
