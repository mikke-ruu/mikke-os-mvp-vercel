"use client";

import { useEffect, useState } from "react";
import { NinteiKozaShell } from "@/components/nintei-koza/NinteiKozaShell";
import { listConversions, markRewardDone, PRODUCT_LABELS, updateRewardAmount } from "@/lib/nintei-koza/conversions";
import { listReferrers } from "@/lib/nintei-koza/referrers";
import type { NinteiKozaConversion, NinteiKozaReferrer } from "@/types/database";

function yen(value: number) {
  return `${value.toLocaleString("ja-JP")}円`;
}

function RewardAmountField({
  conversion,
  onSaved
}: {
  conversion: NinteiKozaConversion;
  onSaved: (next: NinteiKozaConversion) => void;
}) {
  const [value, setValue] = useState(conversion.reward_amount === null ? "" : String(conversion.reward_amount));
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = value.trim();
    const next = trimmed === "" ? null : Math.max(0, Number(trimmed) || 0);
    if (next === conversion.reward_amount) return;
    setSaving(true);
    try {
      onSaved(await updateRewardAmount(conversion.id, next));
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[var(--mikke-muted)]">
      お礼金額
      <input
        type="number"
        min={0}
        step={100}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        disabled={saving}
        placeholder="未設定"
        className="w-24 rounded-lg border border-[var(--mikke-line)] px-2 py-1 text-xs font-normal text-[var(--mikke-text)]"
      />
      円
    </label>
  );
}

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

  function replaceConversion(next: NinteiKozaConversion) {
    setConversions((prev) => prev.map((c) => (c.id === next.id ? next : c)));
  }

  async function toggleDone(id: string, next: boolean) {
    replaceConversion(await markRewardDone(id, next));
  }

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  const rewardTargets = conversions.filter((c) => c.reward_due);
  const pending = rewardTargets.filter((c) => !c.reward_done);
  const done = rewardTargets.filter((c) => c.reward_done);
  const referrerName = (code: string | null) => referrers.find((r) => r.code === code)?.name ?? code ?? "-";

  const pendingTotal = pending.reduce((sum, c) => sum + (c.reward_amount ?? 0), 0);
  const missingAmount = pending.filter((c) => c.reward_amount === null).length;

  const list = showDone ? [...pending, ...done] : pending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-[var(--mikke-muted)]">
            お礼未対応 {pending.length}件 ／ お礼済み {done.length}件
          </p>
          <p className="mt-0.5 text-sm font-bold text-[var(--mikke-text)]">
            未対応の合計 {yen(pendingTotal)}
            {missingAmount > 0 ? (
              <span className="ml-2 text-xs font-normal text-[var(--mikke-muted)]">（金額未設定 {missingAmount}件を除く）</span>
            ) : null}
          </p>
        </div>
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
              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-4 ${
                c.reward_done
                  ? "border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)]"
                  : "border-[var(--mikke-accent)]/40 bg-[var(--mikke-accent-soft)]"
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--mikke-text)]">
                  {referrerName(c.referral)}{" "}
                  <span className="ml-1 text-xs font-normal text-[var(--mikke-muted)]">({c.referral})</span>
                </p>
                <p className="text-xs text-[var(--mikke-muted)]">
                  {PRODUCT_LABELS[c.product]} 成約 {c.amount ? `／ ${yen(c.amount)}` : ""} ／{" "}
                  {new Date(c.created_at).toLocaleDateString("ja-JP")}
                </p>
                <RewardAmountField conversion={c} onSaved={replaceConversion} />
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
