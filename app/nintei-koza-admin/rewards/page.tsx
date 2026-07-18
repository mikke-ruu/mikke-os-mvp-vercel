"use client";

import { useEffect, useState } from "react";
import { NinteiKozaShell } from "@/components/nintei-koza/NinteiKozaShell";
import { listConversions, markRewardDone, PRODUCT_LABELS } from "@/lib/nintei-koza/conversions";
import { listReferrers } from "@/lib/nintei-koza/referrers";
import type { NinteiKozaConversion, NinteiKozaReferrer } from "@/types/database";

function RewardsContent() {
  const [conversions, setConversions] = useState<NinteiKozaConversion[]>([]);
  const [referrers, setReferrers] = useState<NinteiKozaReferrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    Promise.all([listConversions(), listReferrers()]).then(([c, r]) => {
      setConversions(c);
      setReferrers(r);
      setLoading(false);
    });
  }, []);

  async function toggleDone(id: string, next: boolean) {
    const updated = await markRewardDone(id, next);
    setConversions((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  const rewardTargets = conversions.filter((c) => c.reward_due);
  const pending = rewardTargets.filter((c) => !c.reward_done);
  const done = rewardTargets.filter((c) => c.reward_done);
  const referrerName = (code: string | null) => referrers.find((r) => r.code === code)?.name ?? code ?? "-";

  const list = showDone ? [...pending, ...done] : pending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--mikke-muted)]">お礼未対応 {pending.length}件 ／ お礼済み {done.length}件</p>
        <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--mikke-muted)]">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          お礼済みも表示
        </label>
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-center text-sm text-[var(--mikke-muted)]">
          お礼が必要な成約はありません。
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((c) => (
            <li
              key={c.id}
              className={`flex items-center justify-between gap-2 rounded-xl border p-4 ${
                c.reward_done ? "border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)]" : "border-[var(--mikke-accent)]/40 bg-[var(--mikke-accent-soft)]"
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--mikke-text)]">
                  {referrerName(c.referral)} <span className="ml-1 text-xs font-normal text-[var(--mikke-muted)]">({c.referral})</span>
                </p>
                <p className="text-xs text-[var(--mikke-muted)]">
                  {PRODUCT_LABELS[c.product]} 成約 {c.amount ? `／ ${c.amount.toLocaleString()}円` : ""} ／ {new Date(c.created_at).toLocaleDateString("ja-JP")}
                </p>
              </div>
              <button
                onClick={() => toggleDone(c.id, !c.reward_done)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ${
                  c.reward_done ? "bg-white text-[var(--mikke-muted)]" : "bg-[var(--mikke-accent)] text-white"
                }`}
              >
                {c.reward_done ? "お礼済みを解除" : "お礼した✓"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function NinteiKozaRewardsPage() {
  return (
    <NinteiKozaShell title="お礼リスト">
      <RewardsContent />
    </NinteiKozaShell>
  );
}
