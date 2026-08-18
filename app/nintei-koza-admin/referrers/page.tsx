"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Pencil } from "lucide-react";
import { NinteiKozaShell } from "@/components/nintei-koza/NinteiKozaShell";
import {
  buildReferralLink,
  createReferrer,
  isValidReferrerCode,
  listReferrers,
  updateReferrer
} from "@/lib/nintei-koza/referrers";
import type { NinteiKozaReferrer } from "@/types/database";

type Kind = "member" | "buyer" | "other";

const KIND_LABELS: Record<string, string> = { member: "メンバー", buyer: "購入者", other: "その他" };
const KIND_OPTIONS: Kind[] = ["member", "buyer", "other"];

const inputClass = "mt-1 w-full rounded-lg border border-[var(--mikke-line)] px-2 py-2 text-sm font-normal text-[var(--mikke-text)]";
const labelClass = "text-xs font-bold text-[var(--mikke-muted)]";

function yen(value: number) {
  return `${value.toLocaleString("ja-JP")}円`;
}

function CopyLinkButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildReferralLink(code));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--mikke-line)] px-2 py-1 text-[11px] font-bold text-[var(--mikke-text-soft)]"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "コピーしました" : "リンクをコピー"}
    </button>
  );
}

function ReferrerEditor({
  referrer,
  onSaved,
  onCancel
}: {
  referrer: NinteiKozaReferrer;
  onSaved: (next: NinteiKozaReferrer) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(referrer.name);
  const [kind, setKind] = useState<Kind>(referrer.kind);
  const [textbookAmount, setTextbookAmount] = useState(String(referrer.reward_textbook_amount));
  const [kobetsuAmount, setKobetsuAmount] = useState(String(referrer.reward_kobetsu_amount));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) {
      setError("名前を入力してください。");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const next = await updateReferrer(referrer.code, {
        name: name.trim(),
        kind,
        reward_textbook_amount: Math.max(0, Number(textbookAmount) || 0),
        reward_kobetsu_amount: Math.max(0, Number(kobetsuAmount) || 0)
      });
      onSaved(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-[var(--mikke-surface-soft,#faf9f7)] p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className={labelClass}>
          名前
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          種別
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={inputClass}>
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          完全版のお礼金額（円）
          <input
            type="number"
            min={0}
            step={100}
            value={textbookAmount}
            onChange={(e) => setTextbookAmount(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          個別構築のお礼金額（円）
          <input
            type="number"
            min={0}
            step={1000}
            value={kobetsuAmount}
            onChange={(e) => setKobetsuAmount(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <p className="text-[11px] text-[var(--mikke-muted)]">
        0 のままだと金額未設定になります。成約を登録したとき、この金額がお礼リストに入ります。
      </p>
      {error ? <p className="text-xs font-bold text-[var(--mikke-danger)]">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-[var(--mikke-accent)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存する"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[var(--mikke-line)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-text-soft)]"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

function ReferrersContent() {
  const [referrers, setReferrers] = useState<NinteiKozaReferrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingCode, setEditingCode] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("member");
  const [rewardTextbook, setRewardTextbook] = useState(true);
  const [rewardKobetsu, setRewardKobetsu] = useState(false);
  const [rewardTextbookAmount, setRewardTextbookAmount] = useState("0");
  const [rewardKobetsuAmount, setRewardKobetsuAmount] = useState("0");

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
        rewardTextbookAmount: Number(rewardTextbookAmount) || 0,
        rewardKobetsuAmount: Number(rewardKobetsuAmount) || 0,
        note: null
      });
      setReferrers((prev) => [...prev, created]);
      setCode("");
      setName("");
      setKind("member");
      setRewardTextbook(true);
      setRewardKobetsu(false);
      setRewardTextbookAmount("0");
      setRewardKobetsuAmount("0");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました。すでに同じコードがあるかもしれません。");
    } finally {
      setSaving(false);
    }
  }

  function replaceReferrer(next: NinteiKozaReferrer) {
    setReferrers((prev) => prev.map((x) => (x.code === next.code ? next : x)));
  }

  async function toggle(r: NinteiKozaReferrer, field: "active" | "reward_textbook" | "reward_kobetsu") {
    const updated = await updateReferrer(r.code, { [field]: !r[field] });
    replaceReferrer(updated);
  }

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5">
        <h2 className="text-sm font-bold text-[var(--mikke-text)]">紹介者を追加する</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className={labelClass}>
            コード
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase())}
              placeholder="hana"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            名前
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="花" className={inputClass} />
          </label>
          <label className={labelClass}>
            種別
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={inputClass}>
              {KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
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
          <label className={labelClass}>
            完全版のお礼金額（円）
            <input
              type="number"
              min={0}
              step={100}
              value={rewardTextbookAmount}
              onChange={(e) => setRewardTextbookAmount(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            個別構築のお礼金額（円）
            <input
              type="number"
              min={0}
              step={1000}
              value={rewardKobetsuAmount}
              onChange={(e) => setRewardKobetsuAmount(e.target.value)}
              className={inputClass}
            />
          </label>
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
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--mikke-text)]">
                      {r.name}{" "}
                      <span className="ml-1 text-xs font-normal text-[var(--mikke-muted)]">
                        ({r.code} ／ {KIND_LABELS[r.kind]})
                      </span>
                    </p>
                    <p className="mt-1 break-all text-[11px] text-[var(--mikke-muted)]">リンク: {buildReferralLink(r.code)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <CopyLinkButton code={r.code} />
                      <button
                        type="button"
                        onClick={() => setEditingCode(editingCode === r.code ? null : r.code)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--mikke-line)] px-2 py-1 text-[11px] font-bold text-[var(--mikke-text-soft)]"
                      >
                        <Pencil size={12} />
                        {editingCode === r.code ? "編集をとじる" : "編集"}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(r, "active")}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      r.active
                        ? "bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]"
                        : "bg-[var(--mikke-line)] text-[var(--mikke-muted)]"
                    }`}
                  >
                    {r.active ? "有効" : "無効"}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--mikke-muted)]">
                    <input type="checkbox" checked={r.reward_textbook} onChange={() => toggle(r, "reward_textbook")} />
                    完全版お礼あり
                    <span className="font-normal text-[var(--mikke-text-soft)]">
                      {r.reward_textbook_amount > 0 ? yen(r.reward_textbook_amount) : "金額未設定"}
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--mikke-muted)]">
                    <input type="checkbox" checked={r.reward_kobetsu} onChange={() => toggle(r, "reward_kobetsu")} />
                    個別構築お礼あり
                    <span className="font-normal text-[var(--mikke-text-soft)]">
                      {r.reward_kobetsu_amount > 0 ? yen(r.reward_kobetsu_amount) : "金額未設定"}
                    </span>
                  </label>
                </div>

                {editingCode === r.code ? (
                  <ReferrerEditor
                    referrer={r}
                    onSaved={(next) => {
                      replaceReferrer(next);
                      setEditingCode(null);
                    }}
                    onCancel={() => setEditingCode(null)}
                  />
                ) : null}
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
