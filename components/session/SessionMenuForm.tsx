"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionMenus } from "@/lib/session/store";
import type { SessionMenu } from "@/lib/session/types";

export function SessionMenuForm({ menu }: { menu?: SessionMenu }) {
  const router = useRouter();
  const { createMenu, updateMenu } = useSessionMenus();

  const [title, setTitle] = useState(menu?.title ?? "");
  const [summary, setSummary] = useState(menu?.summary ?? "");
  const [description, setDescription] = useState(menu?.description ?? "");
  const [durationLabel, setDurationLabel] = useState(menu?.durationLabel ?? "60分");
  const [priceLabel, setPriceLabel] = useState(menu?.priceLabel ?? "一律");
  const [price, setPrice] = useState(menu?.price != null ? String(menu.price) : "");
  const [availabilityNote, setAvailabilityNote] = useState(menu?.availabilityNote ?? "");
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
      durationLabel: durationLabel.trim(),
      priceLabel: priceLabel.trim(),
      price: price ? Number(price) : null,
      availabilityNote: availabilityNote.trim(),
      published
    };

    if (menu) {
      updateMenu(menu.id, payload);
      router.replace(`/session/admin/${menu.id}`);
    } else {
      const created = createMenu(payload);
      router.replace(`/session/admin/${created.id}`);
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
        <Field label="所要時間">
          <input value={durationLabel} onChange={(e) => setDurationLabel(e.target.value)} placeholder="例：60分" className={inputClass} />
        </Field>
        <Field label="料金の見せ方">
          <input value={priceLabel} onChange={(e) => setPriceLabel(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <Field label="金額（円・任意）">
        <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputClass} />
      </Field>
      <Field label="対応可能な曜日・時間の目安">
        <input value={availabilityNote} onChange={(e) => setAvailabilityNote(e.target.value)} placeholder="例：平日10:00〜17:00" className={inputClass} />
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
