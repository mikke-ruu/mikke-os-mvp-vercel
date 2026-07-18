"use client";

import { useEffect, useState } from "react";
import { NinteiKozaShell } from "@/components/nintei-koza/NinteiKozaShell";
import { createReferrer, isValidReferrerCode, listReferrers, updateReferrer } from "@/lib/nintei-koza/referrers";
import type { NinteiKozaReferrer } from "@/types/database";

const KIND_LABELS: Record<string, string> = { member: "メンバー", buyer: "購入者", other: "その他" };

function ReferrersContent() {
  const [referrers, setReferrers] = useState<NinteiKozaReferrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"member" | "buyer" | "other">("member");
  const [rewardTextbook, setRewardTextbook] = useState(true);
  const [rewardKobetsu, setRewardKobetsu] = useState(false);

  useEffect(() => {
    listReferrers()
      .then(setReferrers)
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isValidReferrerCode(code.trim().toLowerCase())) {
      setError("コードは小文字英数字とハイフンのみ、2〜32文字で入力してください。");
      return;
    }
    if (!name.trim()) {
      setError("名前を入力してください。");
      return;
    }
    setSaving(true);
    try {
      const created = await createReferrer({
        code,
        name,
        kind,
        rewardTextbook,
        rewardKobetsu,
        note: null
      });
      setReferrers((prev) => [...prev, created]);
      setCode("");
      setName("");
      setKind("member");
      setRewardTextbook(true);
      setRewardKobetsu(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました。すでに同じコードがあるかもしれません。");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(r: NinteiKozaReferrer, field: "active" | "reward_textbook" | "reward_kobetsu") {
    const updated = await updateReferrer(r.code, { [field]: !r[field] });
    setReferrers((prev) => prev.map((x) => (x.code === r.code ? updated : x)));
  }

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5">
        <h2 className="text-sm font-bold text-[var(--mikke-text)]">紹介者を追加する</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-bold text-[var(--mikke-muted)]">
            コード
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase())}
              placeholder="hana"
              className="mt-1 w-full rounded-lg border border-[var(--mikke-line)] px-2 py-2 text-sm font-normal text-[var(--mikke-text)]"
            />
          </label>
          <label className="text-xs font-bold text-[var(--mikke-muted)]">
            名前
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="花"
              className="mt-1 w-full rounded-lg border border-[var(--mikke-line)] px-2 py-2 text-sm font-normal text-[var(--mikke-text)]"
            />
          </label>
          <label className="text-xs font-bold text-[var(--mikke-muted)]">
            種別
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "member" | "buyer" | "other")}
              className="mt-1 w-full rounded-lg border border-[var(--mikke-line)] px-2 py-2 text-sm font-normal text-[var(--mikke-text)]"
            >
              <option value="member">メンバー</option>
              <option value="buyer">購入者</option>
              <option value="other">その他</option>
            </select>
          </label>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--mikke-muted)]">
              <input type="checkbox" checked={rewardTextbook} onChange={(e) => setRewardTextbook(e.target.checked)} />
              完全版お礼あり
            </label>
            <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--mikke-muted)]">
              <input type="checkbox" checked={rewardKobetsu} onChange={(e) => setRewardKobetsu(e.target.checked)} />
              個別構築お礼あり
            </label>
          </div>
        </div>
        {error ? <p className="text-xs font-bold text-[var(--mikke-danger)]">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? "登録中…" : "紹介者を追加する"}
        </button>
      </form>

      <div>
        <h2 className="mb-3 text-sm font-bold text-[var(--mikke-text)]">登録済みの紹介者</h2>
        {referrers.length === 0 ? (
          <p className="text-xs text-[var(--mikke-muted)]">まだ登録がありません。</p>
        ) : (
          <ul className="space-y-2">
            {referrers.map((r) => (
              <li key={r.code} className="rounded-xl border border-[var(--mikke-line)] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-[var(--mikke-text)]">
                      {r.name} <span className="ml-1 text-xs font-normal text-[var(--mikke-muted)]">({r.code} ／ {KIND_LABELS[r.kind]})</span>
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--mikke-muted)]">
                      リンク: https://joesstylea-svg.github.io/nintei-koza-site/?r={r.code}
                    </p>
                  </div>
                  <button
                    onClick={() => toggle(r, "active")}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      r.active ? "bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]" : "bg-[var(--mikke-line)] text-[var(--mikke-muted)]"
                    }`}
                  >
                    {r.active ? "有効" : "無効"}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--mikke-muted)]">
                    <input type="checkbox" checked={r.reward_textbook} onChange={() => toggle(r, "reward_textbook")} />
                    完全版お礼あり
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--mikke-muted)]">
                    <input type="checkbox" checked={r.reward_kobetsu} onChange={() => toggle(r, "reward_kobetsu")} />
                    個別構築お礼あり
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function NinteiKozaReferrersPage() {
  return (
    <NinteiKozaShell title="紹介者管理">
      <ReferrersContent />
    </NinteiKozaShell>
  );
}
