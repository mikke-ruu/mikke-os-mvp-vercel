"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrderMenus } from "@/lib/order/store";
import type { OrderMenu } from "@/lib/order/types";

export function OrderMenuForm({ menu }: { menu?: OrderMenu }) {
  const router = useRouter();
  const { createMenu, updateMenu } = useOrderMenus();

  const [title, setTitle] = useState(menu?.title ?? "");
  const [summary, setSummary] = useState(menu?.summary ?? "");
  const [description, setDescription] = useState(menu?.description ?? "");
  const [priceLabel, setPriceLabel] = useState(menu?.priceLabel ?? "一律");
  const [price, setPrice] = useState(menu?.price != null ? String(menu.price) : "");
  const [leadTimeLabel, setLeadTimeLabel] = useState(menu?.leadTimeLabel ?? "");
  const [recommendedFor, setRecommendedFor] = useState(menu?.recommendedFor ?? "");
  const [published, setPublished] = useState(menu?.published ?? true);
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 && !saving;

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!canSave) return;
    setSaving(true);

    const payload = {
      title: title.trim(),
      summary: summary.trim(),
      description: description.trim(),
      priceLabel: priceLabel.trim(),
      price: price ? Number(price) : null,
      leadTimeLabel: leadTimeLabel.trim(),
      recommendedFor: recommendedFor.trim(),
      published
    };

    if (menu) {
      updateMenu(menu.id, payload);
      router.replace(`/order/admin/${menu.id}`);
    } else {
      const created = createMenu(payload);
      router.replace(`/order/admin/${created.id}`);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="メニュー名" required>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
      </Field>
      <Field label="概要（一覧・LP用の短い説明）">
        <input value={summary} onChange={(e) => setSummary(e.target.value)} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="料金の見せ方">
          <input value={priceLabel} onChange={(e) => setPriceLabel(e.target.value)} placeholder="例：一律 / 〜から" className={inputClass} />
        </Field>
        <Field label="金額（円・任意）">
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputClass} />
        </Field>
      </div>
      <Field label="納期の目安">
        <input value={leadTimeLabel} onChange={(e) => setLeadTimeLabel(e.target.value)} placeholder="例：1週間程度" className={inputClass} />
      </Field>
      <Field label="おすすめ対象">
        <input value={recommendedFor} onChange={(e) => setRecommendedFor(e.target.value)} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm font-semibold text-[var(--mikke-text)]">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        公開する
      </label>
      <Field label="詳細（公開ページに表示）">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className={`${inputClass} resize-none`} />
      </Field>

      <button
        type="submit"
        disabled={!canSave}
        className="w-full rounded-full bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
      >
        {saving ? "保存しています…" : menu ? "変更を保存" : "メニューを作成"}
      </button>
    </form>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-[var(--mikke-text)]">
        {label}
        {required ? <span className="ml-1 text-[var(--mikke-accent)]">*</span> : null}
      </span>
      {children}
    </label>
  );
}
