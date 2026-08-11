import Link from "next/link";

export default function MarketNoteStartPage() {
  return (
    <main className="min-h-dvh bg-[var(--mikke-surface-soft)] px-4 py-8 text-[var(--mikke-text)] sm:px-5 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-lg items-center">
        <section className="w-full rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-5 py-7 shadow-sm sm:px-8 sm:py-9">
          <header>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mikke-primary)]">MARKETNOTE</p>
            <h1 className="mt-3 text-2xl font-bold tracking-normal text-[var(--mikke-primary)] sm:text-3xl">
              仕事の予定と収支を、かんたんに。
            </h1>
            <p className="mt-4 text-sm leading-7 text-[var(--mikke-muted)]">
              予定を入れて、タスクを整えて、必要なときだけ売上と経費を記録できます。
            </p>
          </header>

          <div className="mt-8 space-y-6">
            <div>
              <Link
                href="/marketnote"
                className="flex min-h-12 w-full items-center justify-center rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-center text-sm font-bold text-white"
              >
                ログインせずに使ってみる
              </Link>
              <p className="mt-2 text-center text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
                記録はこの端末に保存されます
              </p>
            </div>

            <div>
              <Link
                href="/login?next=/marketnote"
                className="flex min-h-12 w-full items-center justify-center rounded-lg border border-[var(--mikke-line)] bg-white px-4 py-3 text-center text-sm font-bold text-[var(--mikke-text)]"
              >
                ログインして使う
              </Link>
              <div className="mt-2 text-center text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
                <p>別の端末でも続きが見られます</p>
                <p>すでにmikkeをお使いの方はこちら</p>
              </div>
            </div>
          </div>

          <p className="mt-8 border-t border-[var(--mikke-line)] pt-5 text-center text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
            あとからログインしても、この端末の記録は引き継げます。
          </p>
        </section>
      </div>
    </main>
  );
}
