"use client";

import { useEffect, useState } from "react";
import { NinteiKozaShell } from "@/components/nintei-koza/NinteiKozaShell";
import { listConversions, PRODUCT_LABELS } from "@/lib/nintei-koza/conversions";
import { listReferrers } from "@/lib/nintei-koza/referrers";
import type { NinteiKozaConversion, NinteiKozaProduct, NinteiKozaReferrer } from "@/types/database";

const PRODUCTS: NinteiKozaProduct[] = ["textbook", "kobetsu", "academy", "community"];
const REWARD_TARGET_PRODUCTS: NinteiKozaProduct[] = ["textbook", "kobetsu"];

function SummaryContent() {
  const [conversions, setConversions] = useState<NinteiKozaConversion[]>([]);
  const [referrers, setReferrers] = useState<NinteiKozaReferrer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listConversions(), listReferrers()]).then(([c, r]) => {
      setConversions(c);
      setReferrers(r);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  const byProduct = PRODUCTS.map((p) => {
    const rows = conversions.filter((c) => c.product === p);
    return { product: p, count: rows.length, amount: rows.reduce((sum, r) => sum + (r.amount ?? 0), 0) };
  });

  const referrerRows = referrers.map((r) => {
    const rows = conversions.filter((c) => c.referral === r.code);
    return { referrer: r, count: rows.length, rewardDue: rows.filter((c) => c.reward_due).length };
  });

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-bold text-[var(--mikke-text)]">商品別の成約</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {byProduct.map((row) => (
            <div key={row.product} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
              <p className="text-xs font-bold text-[var(--mikke-muted)]">
                {PRODUCT_LABELS[row.product]}
                {!REWARD_TARGET_PRODUCTS.includes(row.product) ? <span className="ml-1 text-[10px] font-normal">(お礼対象外)</span> : null}
              </p>
              <p className="mt-2 text-2xl font-bold text-[var(--mikke-text)]">
                {row.count}
                <span className="ml-1 text-xs font-bold text-[var(--mikke-muted-light)]">件</span>
              </p>
              <p className="text-xs text-[var(--mikke-muted)]">{row.amount.toLocaleString()}円</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-[var(--mikke-text)]">紹介者別の成約</h2>
        {referrerRows.length === 0 ? (
          <p className="text-xs text-[var(--mikke-muted)]">紹介者が登録されていません。</p>
        ) : (
          <ul className="space-y-2">
            {referrerRows.map(({ referrer, count, rewardDue }) => (
              <li key={referrer.code} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-2.5">
                <div>
                  <p className="text-sm font-bold text-[var(--mikke-text)]">
                    {referrer.name} <span className="ml-1 text-xs font-normal text-[var(--mikke-muted)]">({referrer.code})</span>
                  </p>
                  <p className="text-[11px] text-[var(--mikke-muted)]">
                    完全版{referrer.reward_textbook ? "お礼あり" : "お礼なし"} ／ 個別構築{referrer.reward_kobetsu ? "お礼あり" : "お礼なし"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[var(--mikke-text)]">{count}件成約</p>
                  {rewardDue > 0 ? <p className="text-[11px] text-[var(--mikke-accent-strong)]">お礼対象 {rewardDue}件</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function NinteiKozaSummaryPage() {
  return (
    <NinteiKozaShell title="売れ行きサマリー">
      <SummaryContent />
    </NinteiKozaShell>
  );
}
