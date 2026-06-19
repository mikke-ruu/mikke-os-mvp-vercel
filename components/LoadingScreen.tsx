export function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] px-6">
      <div className="rounded-2xl border border-[#e8e1da] bg-white px-6 py-5 text-center shadow-sm">
        <p className="text-sm font-semibold text-[#d9643a]">Mikke OS</p>
        <p className="mt-2 text-sm text-[#79716b]">読み込み中です</p>
      </div>
    </main>
  );
}
