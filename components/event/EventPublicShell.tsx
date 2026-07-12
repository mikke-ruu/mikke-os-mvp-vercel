import Link from "next/link";

export function EventPublicShell({
  title,
  backHref,
  children
}: {
  title: string;
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--mikke-surface-soft)]">
      <header className="border-b border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {backHref ? (
            <Link href={backHref} className="text-sm font-bold text-[var(--mikke-muted)]">
              ← 戻る
            </Link>
          ) : null}
          <p className="text-lg font-bold tracking-normal text-[var(--mikke-text)]">{title}</p>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-6">{children}</div>
      <footer className="py-6 text-center text-xs font-semibold text-[var(--mikke-muted-light)]">Event by mikke</footer>
    </main>
  );
}
