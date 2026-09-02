import {
  ACADEMY_PLATFORM_PRICE_ROWS,
  describeAcademySubscription,
  formatAcademyBillingDate,
  formatAcademyBillingYen,
  type AcademyPlatformBillingState,
} from "@/lib/academy/platform-billing-view";

const card = "min-w-0 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-5";
const disabledButton = "min-h-11 w-full rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3 text-sm font-semibold text-[var(--mikke-muted)] disabled:cursor-not-allowed";

/** No network or mutation handlers. Actions stay disabled until shared billing is approved. */
export function AcademyPlatformBillingPanel({ state }: { state: AcademyPlatformBillingState }) {
  if (state.kind !== "owner") {
    const message = {
      loading: "契約情報を確認しています。",
      unavailable: "契約情報を取得できませんでした。未契約や0円としては扱いません。時間をおいて再度確認してください。",
      forbidden: "この本部の契約・請求は、本部オーナーだけが確認できます。",
      sign_in_required: "契約情報を確認するには、もう一度ログインしてください。",
      not_configured: "契約・請求の接続を準備しています。まだこの画面から申し込みはできません。",
      policy_pending: "申込条件の確認が終わるまで、契約手続きは利用できません。",
      state_conflict: "契約の状態が変わりました。もう一度、最新の情報を確認してください。",
      invalid_request: "契約情報の確認先を特定できません。本部を選び直してください。",
    }[state.kind];
    return <section className={card} role="status"><h2 className="font-semibold">Academy利用料</h2><p className="mt-3 leading-7">{message}</p></section>;
  }

  const status = describeAcademySubscription(state.subscriptionStatus);
  const snapshot = state.snapshot;
  return (
    <div className="space-y-5 text-[var(--mikke-text)]">
      <header>
        <p className="text-sm font-semibold text-[var(--mikke-primary)]">本部オーナーの契約・請求</p>
        <h1 className="mt-2 text-2xl font-bold">Academy利用料</h1>
        <p className="mt-3 leading-7">本部の運営に使うアプリの月額料金です。受講者から受け取る受講料、スキルビジネス構築コースの購入代とは別です。</p>
      </header>

      <section className={card}>
        <h2 className="font-bold">構築コースを購入された方へ</h2>
        <p className="mt-2 leading-7">{state.constructionPurchase === "confirmed_awaiting_monthly_contract"
          ? "構築コースの購入確認済みです。Academy月額利用の開始手続きはまだ完了していません。"
          : "構築コースの購入状況は、この画面ではまだ確認していません。"}</p>
        <p className="mt-2 leading-7">構築コースの購入確認と、Academyの月額契約・本部作成は別の手続きです。</p>
      </section>

      <section className={card} aria-labelledby="academy-contract-title">
        <h2 id="academy-contract-title" className="text-lg font-bold">{status.title}</h2>
        <p className="mt-2 leading-7">{status.description}</p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm font-semibold">本部の利用準備</dt><dd className="mt-1">{{ unverified: "本部の利用可否は別途確認が必要です", not_created: "本部はまだ作成されていません", preparing: "本部の利用開始を準備しています", ready: "本部の準備ができています" }[state.headquartersState]}</dd></div>
          <div><dt className="text-sm font-semibold">利用終了予定日</dt><dd className="mt-1">{formatAcademyBillingDate(state.accessEndsAt)}</dd></div>
        </dl>
      </section>

      <section className={card} aria-labelledby="academy-invoice-title">
        <h2 id="academy-invoice-title" className="text-lg font-bold">次回の請求</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm font-semibold">請求予定額（税込）</dt><dd className="mt-2 text-2xl font-bold">{formatAcademyBillingYen(state.nextInvoice?.amountYen)}</dd></div>
          <div><dt className="text-sm font-semibold">請求予定日</dt><dd className="mt-2">{formatAcademyBillingDate(state.nextInvoice?.date)}</dd></div>
        </dl>
        <p className="mt-4 leading-7">下の人数記録は請求の根拠です。人数から求めた金額と、決済サービスの請求予定額は分けて表示します。</p>
      </section>

      <section className={card} aria-labelledby="academy-snapshot-title">
        <h2 id="academy-snapshot-title" className="text-lg font-bold">月末の登録人数と料金記録</h2>
        {snapshot ? <>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-sm font-semibold">集計基準日（日本時間）</dt><dd>{formatAcademyBillingDate(snapshot.cutoffAt)}</dd></div>
            <div><dt className="text-sm font-semibold">登録中の講師</dt><dd>{snapshot.registeredCount}名</dd></div>
            <div><dt className="text-sm font-semibold">人数に応じた通常月額（税込）</dt><dd>{formatAcademyBillingYen(snapshot.catalogPriceYen)}</dd></div>
            <div><dt className="text-sm font-semibold">料金記録上の適用額（税込）</dt><dd>{formatAcademyBillingYen(snapshot.scheduledPriceYen)}</dd></div>
            <div><dt className="text-sm font-semibold">料金記録の適用月</dt><dd>{formatAcademyBillingDate(snapshot.chargeMonth)}</dd></div>
          </dl>
          <p className="mt-4 font-semibold" role="status">{{ pending: "請求内容との照合待ちです。請求確定ではありません。", matched: "請求内容と料金記録の一致を確認済みです。", mismatch: "請求内容と料金記録が一致していません。運営による確認が必要です。" }[snapshot.reconciliation]}</p>
        </> : <p className="mt-3 leading-7">月末の人数記録はまだ確認できません。登録人数を0名とはみなしません。</p>}
        <p className="mt-4 leading-7">本部オーナーも講師登録していれば1名に数えます。休眠・活動停止中も登録中は対象です。招待中の未登録者は数えず、同じ本部の同一人物は1名です。</p>
      </section>

      <section className={card} aria-labelledby="academy-actions-title">
        <h2 id="academy-actions-title" className="text-lg font-bold">申込・請求管理</h2>
        <p id="academy-billing-unavailable" className="mt-3 leading-7 font-semibold">決済・契約管理との接続は準備中です。この画面から申込・支払方法の変更・解約はできません。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {["料金・条件を確認して申し込む", "請求履歴を確認する", "支払方法を変更する", "Academyを解約する"].map((label) => <button key={label} type="button" disabled aria-describedby="academy-billing-unavailable" className={disabledButton}>{label}</button>)}
        </div>
        <p className="mt-4 leading-7">ここで扱うのはAcademy利用料のみです。Communityの通常契約や、受講料・構築コース購入代の返金や解約は変更しません。</p>
      </section>

      <section className={card} aria-labelledby="academy-prices-title">
        <h2 id="academy-prices-title" className="text-lg font-bold">Academyの月額料金（税込）</h2>
        <div className="mt-4 space-y-3">
          {ACADEMY_PLATFORM_PRICE_ROWS.map((row) => <div key={row.limit} className="rounded-xl bg-[var(--mikke-surface-soft)] p-4">
            <h3 className="font-semibold">登録中の講師 {row.limit}</h3>
            <p className="mt-1 font-bold">{row.monthly}／月</p>
            <p className="mt-1 text-sm">上限利用時の1名あたり：{row.perPerson}</p>
          </div>)}
        </div>
        <p className="mt-4 leading-7">請求先は本部オーナーです。講師個人にAcademy利用料は請求しません。Communityは任意の別サービスで、この月額料金には含みません。</p>
      </section>
    </div>
  );
}
