"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { FundPublicShell } from "@/components/fund/FundPublicShell";
import { getMyFundParticipations, type FundParticipation } from "@/lib/fund/identity";

function FundMeContent() {
  const [items, setItems] = useState<FundParticipation[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyFundParticipations().then(setItems).catch(() => setError("応援の記録を読み込めませんでした。"));
  }, []);

  return (
    <FundPublicShell title="あなたのFund">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-normal">受け取った応援</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--mikke-muted)]">公開するかどうか、表示名、匿名表示はそれぞれの記録で変更できます。</p>
        {error ? <p className="mt-5 rounded-lg bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--mikke-accent-strong)]">{error}</p> : null}
        <div className="mt-7 divide-y divide-[var(--mikke-line)] border-y border-[var(--mikke-line)]">
          {items.map((item) => (
            <Link key={item.id} href={`/fund/me/${item.id}`} className="block py-4 transition hover:bg-[var(--mikke-surface-soft)]">
              <p className="text-sm font-bold">応援の記録</p>
              <p className="mt-1 text-xs text-[var(--mikke-muted)]">{item.supporter_consent_status === "granted" ? "公開設定済み" : "公開設定は未完了"}</p>
            </Link>
          ))}
          {items.length === 0 && !error ? <p className="py-8 text-sm text-[var(--mikke-muted)]">まだ受け取った応援の記録はありません。</p> : null}
        </div>
      </div>
    </FundPublicShell>
  );
}

export default function FundMePage() {
  return <AuthGate><FundMeContent /></AuthGate>;
}
