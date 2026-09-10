import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--mikke-surface-soft)] px-5 text-center">
      <section className="w-full max-w-md rounded-2xl border border-[var(--mikke-line)] bg-white p-8 shadow-[var(--mikke-shadow-panel)]">
        <p className="text-xs font-bold tracking-[0.18em] text-[var(--mikke-primary)]">MIKKE</p>
        <h1 className="mt-4 text-2xl font-bold text-[var(--mikke-text)]">ページが見つかりません</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--mikke-muted)]">
          URLが変更されたか、現在は公開されていないページです。
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--mikke-primary)] px-5 py-3 text-sm font-bold text-white"
        >
          トップへ戻る
        </Link>
      </section>
    </main>
  );
}
