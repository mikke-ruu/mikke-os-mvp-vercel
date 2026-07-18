"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NinteiKozaShell } from "@/components/nintei-koza/NinteiKozaShell";
import { listInquiries } from "@/lib/nintei-koza/inquiries";
import { listReferrers } from "@/lib/nintei-koza/referrers";
import { calcRewardDue, createConversion, listConversions, PRODUCT_LABELS } from "@/lib/nintei-koza/conversions";
import type { NinteiKozaConversion, NinteiKozaInquiry, NinteiKozaProduct, NinteiKozaReferrer } from "@/types/database";

const PRODUCTS: NinteiKozaProduct[] = ["textbook", "kobetsu", "academy", "community"];

function ConversionsContent() {
  const searchParams = useSearchParams();
  const presetInquiryId = searchParams.get("inquiryId") || "";

  const [inquiries, setInquiries] = useState<NinteiKozaInquiry[]>([]);
  const [referrers, setReferrers] = useState<NinteiKozaReferrer[]>([]);
  const [conversions, setConversions] = useState<NinteiKozaConversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [inquiryId, setInquiryId] = useState(presetInquiryId);
  const [product, setProduct] = useState<NinteiKozaProduct>("textbook");
  const [amount, setAmount] = useState("");
  const [referral, setReferral] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    Promise.all([listInquiries(), listReferrers(), listConversions()]).then(([i, r, c]) => {
      setInquiries(i);
      setReferrers(r);
      setConversions(c);
      if (presetInquiryId) {
        const found = i.find((x) => x.id === presetInquiryId);
        if (found) {
          setProduct(found.topic === "kobetsu" || found.topic === "textbook" ? found.topic : "textbook");
          setReferral(found.referral || "");
        }
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewRewardDue = calcRewardDue(product, referral || null, referrers);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await createConversion(
        {
          inquiryId: inquiryId || null,
          product,
          amount: amount ? Number(amount) : null,
          referral: referral || null,
          note: note || null
        },
        referrers
      );
      setConversions((prev) => [created, ...prev]);
      setInquiryId("");
      setAmount("");
      setReferral("");
      setNote("");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5">
        <h2 className="text-sm font-bold text-[var(--mikke-text)]">成約を登録する</h2>
        <p className="text-xs text-[var(--mikke-muted)]">
          問い合わせ経由でも、DM等フォーム外の成約でも登録できます。紹介コードを入れると、お礼対象かどうかを自動判定します。
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-bold text-[var(--mikke-muted)]">
            紐づける問い合わせ(任意)
            <select
              value={inquiryId}
              onChange={(e) => {
                setInquiryId(e.target.value);
                const found = inquiries.find((x) => x.id === e.target.value);
                if (found?.referral) setReferral(found.referral);
              }}
              className="mt-1 w-full rounded-lg border border-[var(--mikke-line)] px-2 py-2 text-sm font-normal text-[var(--mikke-text)]"
            >
              <option value="">(なし・手入力)</option>
              {inquiries.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} / {i.email}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold text-[var(--mikke-muted)]">
            商品
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value as NinteiKozaProduct)}
              className="mt-1 w-full rounded-lg border border-[var(--mikke-line)] px-2 py-2 text-sm font-normal text-[var(--mikke-text)]"
            >
              {PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {PRODUCT_LABELS[p]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold text-[var(--mikke-muted)]">
            金額(任意)
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="39800"
              className="mt-1 w-full rounded-lg border border-[var(--mikke-line)] px-2 py-2 text-sm font-normal text-[var(--mikke-text)]"
            />
          </label>

          <label className="text-xs font-bold text-[var(--mikke-muted)]">
            紹介コード(任意)
            <input
              type="text"
              value={referral}
              onChange={(e) => setReferral(e.target.value.toLowerCase())}
              placeholder="neon"
              className="mt-1 w-full rounded-lg border border-[var(--mikke-line)] px-2 py-2 text-sm font-normal text-[var(--mikke-text)]"
            />
          </label>
        </div>

        <label className="block text-xs font-bold text-[var(--mikke-muted)]">
          メモ(任意)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-[var(--mikke-line)] px-2 py-2 text-sm font-normal text-[var(--mikke-text)]"
          />
        </label>

        <p className="text-xs font-bold">
          お礼対象:{" "}
          {previewRewardDue ? (
            <span className="text-[var(--mikke-accent-strong)]">あり(お礼リストに入ります)</span>
          ) : (
            <span className="text-[var(--mikke-muted)]">なし</span>
          )}
        </p>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[var(--mikke-accent)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? "登録中…" : "成約を登録する"}
        </button>
      </form>

      <div>
        <h2 className="mb-3 text-sm font-bold text-[var(--mikke-text)]">最近の成約</h2>
        {conversions.length === 0 ? (
          <p className="text-xs text-[var(--mikke-muted)]">まだ成約はありません。</p>
        ) : (
          <ul className="space-y-2">
            {conversions.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--mikke-text)]">
                    {PRODUCT_LABELS[c.product]} {c.amount ? `／ ${c.amount.toLocaleString()}円` : ""}
                  </p>
                  <p className="text-[11px] text-[var(--mikke-muted)]">
                    {c.referral ? `紹介: ${c.referral}` : "紹介なし"} ／ {new Date(c.created_at).toLocaleDateString("ja-JP")}
                  </p>
                </div>
                {c.reward_due ? (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      c.reward_done ? "bg-[var(--mikke-line)] text-[var(--mikke-muted)]" : "bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]"
                    }`}
                  >
                    {c.reward_done ? "お礼済み" : "お礼対象"}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function NinteiKozaConversionsPage() {
  return (
    <NinteiKozaShell title="成約登録">
      <ConversionsContent />
    </NinteiKozaShell>
  );
}
