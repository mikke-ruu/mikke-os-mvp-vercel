"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useItemStudio } from "@/lib/item-studio/store";
import type { StudioItem } from "@/lib/item-studio/types";

export function StudioItemForm({ item }: { item?: StudioItem }) {
  const router = useRouter();
  const { createItem, updateItem } = useItemStudio();

  const [title, setTitle] = useState(item?.title ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [color, setColor] = useState(item?.color ?? "");
  const [material, setMaterial] = useState(item?.material ?? "");
  const [condition, setCondition] = useState(item?.condition ?? "");
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : "");
  const [cost, setCost] = useState(item?.cost != null ? String(item.cost) : "");
  const [stock, setStock] = useState(item?.stock != null ? String(item.stock) : "1");
  const [photoUrl, setPhotoUrl] = useState(item?.photoUrl ?? "");
  const [published, setPublished] = useState(item?.published ?? false);
  const [description, setDescription] = useState(item?.description ?? "");
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 && !saving;

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!canSave) return;
    setSaving(true);

    const payload = {
      title: title.trim(),
      category: category.trim(),
      color: color.trim(),
      material: material.trim(),
      condition: condition.trim(),
      price: price ? Number(price) : null,
      cost: cost ? Number(cost) : null,
      stock: stock ? Number(stock) : 0,
      photoUrl: photoUrl.trim(),
      published,
      description: description.trim()
    };

    if (item) {
      updateItem(item.id, payload);
      router.replace(`/item-studio/${item.id}`);
    } else {
      const created = createItem(payload);
      router.replace(`/item-studio/${created.id}`);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="商品名" required>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="カテゴリ">
          <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} />
        </Field>
        <Field label="カラー">
          <input value={color} onChange={(e) => setColor(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="素材">
          <input value={material} onChange={(e) => setMaterial(e.target.value)} className={inputClass} />
        </Field>
        <Field label="状態（中古品向け）">
          <input value={condition} onChange={(e) => setCondition(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="販売価格（円）">
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputClass} />
        </Field>
        <Field label="原価（円・任意）">
          <input value={cost} onChange={(e) => setCost(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputClass} />
        </Field>
        <Field label="在庫数">
          <input value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputClass} />
        </Field>
      </div>
      <Field label="写真URL（任意）">
        <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm font-semibold text-[var(--mikke-text)]">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Storyの作品ポートフォリオに公開する
      </label>
      <Field label="説明">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={`${inputClass} resize-none`} />
      </Field>

      <button
        type="submit"
        disabled={!canSave}
        className="w-full rounded-full bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
      >
        {saving ? "保存しています…" : item ? "変更を保存" : "商品を登録"}
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
