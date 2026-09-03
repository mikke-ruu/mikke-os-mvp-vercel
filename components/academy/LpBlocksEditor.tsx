"use client";

// Wave F (AC-F3): app/academy/courses/[id]/lp/page.tsx (Wave C) にあった
// AcademyLpBlock用のBlockEditor UIを共通コンポーネントとして切り出し、
// app/academy/front/page.tsx（フロントのブロックビルダー）と共用する。
import {
  ArrowDown,
  ArrowUp,
  Heading,
  Image as ImageIcon,
  LayoutGrid,
  LayoutPanelLeft,
  MousePointerClick,
  Plus,
  Trash2,
  Type
} from "lucide-react";
import { AcademyImageUploader } from "@/components/academy/AcademyImageUploader";
import type { AcademyLpBlock } from "@/types/database";

const inputClass =
  "min-w-0 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-base text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)] sm:text-sm";

export const LP_BLOCK_LABEL: Record<AcademyLpBlock["type"], string> = {
  heading: "見出し",
  text: "文章",
  image: "画像",
  "image-text": "画像+文章",
  gallery: "画像グリッド",
  cta: "CTA"
};

export function newLpBlock(type: AcademyLpBlock["type"]): AcademyLpBlock {
  if (type === "heading") return { type: "heading", text: "" };
  if (type === "image") return { type: "image", url: "", caption: "" };
  if (type === "image-text") return { type: "image-text", imageUrl: "", heading: "", text: "" };
  if (type === "gallery") return { type: "gallery", images: [] };
  if (type === "cta") return { type: "cta", heading: "", buttonLabel: "", buttonUrl: "" };
  return { type: "text", text: "" };
}

export function LpBlockEditor({ block, onChange }: { block: AcademyLpBlock; onChange: (b: AcademyLpBlock) => void }) {
  if (block.type === "heading")
    return <input className={inputClass} placeholder="見出しテキスト" value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} />;

  if (block.type === "text")
    return <textarea className={`${inputClass} min-h-20`} placeholder="本文" value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} />;

  if (block.type === "image")
    return (
      <>
        <AcademyImageUploader compact currentUrl={block.url || undefined} onUploaded={(url) => onChange({ ...block, url })} />
        <input className={inputClass} placeholder="キャプション（任意）" value={block.caption ?? ""} onChange={(e) => onChange({ ...block, caption: e.target.value })} />
      </>
    );

  if (block.type === "image-text")
    return (
      <>
        <AcademyImageUploader compact currentUrl={block.imageUrl || undefined} onUploaded={(url) => onChange({ ...block, imageUrl: url })} />
        <input className={inputClass} placeholder="見出し（任意）" value={block.heading ?? ""} onChange={(e) => onChange({ ...block, heading: e.target.value })} />
        <textarea className={`${inputClass} min-h-16`} placeholder="文章" value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} />
      </>
    );

  if (block.type === "gallery")
    return (
      <div className="space-y-2">
        {block.images.map((img, i) => (
          <div key={i} className="min-w-0 space-y-1 overflow-hidden rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-2">
            <AcademyImageUploader
              compact
              currentUrl={img.url || undefined}
              onUploaded={(url) => onChange({ ...block, images: block.images.map((x, j) => (j === i ? { ...x, url } : x)) })}
            />
            <div className="flex items-center gap-1">
              <input
                className={inputClass}
                placeholder="キャプション（任意）"
                value={img.caption ?? ""}
                onChange={(e) => onChange({ ...block, images: block.images.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)) })}
              />
              <button type="button" className="shrink-0 text-[var(--mikke-danger)]" onClick={() => onChange({ ...block, images: block.images.filter((_, j) => j !== i) })}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...block, images: [...block.images, { url: "", caption: "" }] })}
          className="flex items-center gap-1 text-xs font-bold text-[var(--mikke-accent-strong)]"
        >
          <Plus size={13} /> 画像を追加
        </button>
      </div>
    );

  // cta（見出し+ボタン）
  return (
    <>
      <input className={inputClass} placeholder="見出し" value={block.heading} onChange={(e) => onChange({ ...block, heading: e.target.value })} />
      <input className={inputClass} placeholder="ボタンのラベル（例: 詳しく見る）" value={block.buttonLabel} onChange={(e) => onChange({ ...block, buttonLabel: e.target.value })} />
      <input className={inputClass} placeholder="ボタンのリンクURL" value={block.buttonUrl} onChange={(e) => onChange({ ...block, buttonUrl: e.target.value })} />
    </>
  );
}

const ADD_BUTTONS: { type: AcademyLpBlock["type"]; icon: typeof Heading }[] = [
  { type: "heading", icon: Heading },
  { type: "text", icon: Type },
  { type: "image", icon: ImageIcon },
  { type: "image-text", icon: LayoutPanelLeft },
  { type: "gallery", icon: LayoutGrid },
  { type: "cta", icon: MousePointerClick }
];

// ブロック一覧＋並べ替え＋追加ボタンまでを含む完結したエディタ。
// LPビルダー・フロント編集の両方から同じ見た目・操作感で使う。
export function LpBlocksEditor({ blocks, onChange }: { blocks: AcademyLpBlock[]; onChange: (blocks: AcademyLpBlock[]) => void }) {
  function update(i: number, b: AcademyLpBlock) {
    onChange(blocks.map((x, j) => (j === i ? b : x)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function add(type: AcademyLpBlock["type"]) {
    onChange([...blocks, newLpBlock(type)]);
  }
  function remove(i: number) {
    onChange(blocks.filter((_, j) => j !== i));
  }

  return (
    <div className="space-y-3">
      {blocks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white p-6 text-center text-sm text-[var(--mikke-muted)]">
          まだブロックがありません。下のボタンで追加します。
        </p>
      ) : (
        <ul className="space-y-2">
          {blocks.map((block, i) => (
            <li key={i} className="min-w-0 space-y-2 overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[var(--mikke-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">
                  {LP_BLOCK_LABEL[block.type]}
                </span>
                <div className="flex items-center gap-2 text-[var(--mikke-muted)]">
                  <button type="button" onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
                  <button type="button" onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
                  <button type="button" onClick={() => remove(i)} className="text-[var(--mikke-danger)]"><Trash2 size={15} /></button>
                </div>
              </div>
              <LpBlockEditor block={block} onChange={(b) => update(i, b)} />
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ADD_BUTTONS.map(({ type, icon: Icon }) => (
          <button
            key={type}
            type="button"
            onClick={() => add(type)}
            className="flex flex-col items-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white py-2 text-[10px] font-bold text-[var(--mikke-text-soft)]"
          >
            <Icon size={14} /> {LP_BLOCK_LABEL[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
