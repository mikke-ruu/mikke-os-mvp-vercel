export function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--mikke-surface-soft)] px-6">
      <div className="rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-6 py-5 text-center shadow-sm">
        <p className="text-sm font-semibold text-[var(--mikke-muted)]">Loading</p>
      </div>
    </main>
  );
}
