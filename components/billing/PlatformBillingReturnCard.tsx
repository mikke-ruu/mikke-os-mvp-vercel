import Link from "next/link";

type PlatformBillingReturnCardProps = {
  outcome: "success" | "cancel";
};

export function PlatformBillingReturnCard({ outcome }: PlatformBillingReturnCardProps) {
  const succeeded = outcome === "success";

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--mikke-surface-soft)] px-5 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-[var(--mikke-line)] bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold tracking-[0.18em] text-[var(--mikke-primary)]">mikkeOS</p>
        <h1 className="mt-3 text-2xl font-bold text-[var(--mikke-text)]">
          {succeeded ? "お支払い状況を確認しています" : "お申し込みを中止しました"}
        </h1>
        <p className="mt-4 text-sm leading-7 text-[var(--mikke-muted)]">
          {succeeded
            ? "この画面が表示されただけでは、契約や利用権は確定しません。決済会社からの確認が届いたあと、各アプリの契約画面で最新の状態を確認してください。"
            : "決済は完了しておらず、新しい契約や利用権も開始されていません。もう一度申し込む場合は、各アプリの契約画面へ戻ってください。"}
        </p>
        {succeeded ? (
          <div className="mt-5 rounded-2xl bg-[var(--mikke-surface-soft)] p-4 text-sm leading-6 text-[var(--mikke-text)]">
            反映まで少し時間がかかることがあります。契約画面を開き直すと、サーバーから最新状態を取得します。
          </div>
        ) : null}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link href="/academy/select" className="rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-center text-sm font-bold text-white">
            Academyを確認
          </Link>
          <Link href="/community/for-organizers" className="rounded-xl border border-[var(--mikke-line)] px-4 py-3 text-center text-sm font-bold text-[var(--mikke-text)]">
            Communityを確認
          </Link>
        </div>
      </section>
    </main>
  );
}
