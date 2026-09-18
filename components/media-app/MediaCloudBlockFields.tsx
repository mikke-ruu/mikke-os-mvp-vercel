"use client";
import { useEffect, useRef } from "react";
import type { MediaBlock } from "@/lib/media-app/types";
import { MediaImagePicker } from "./MediaImagePicker";

const inputClass = "mt-1 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)]";

function InlineText({ block, onChange, onSplit }: {
  block: MediaBlock; onChange: (block: MediaBlock) => void;
  onSplit?: (start: number, end: number) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "0px";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [block.text]);
  return <textarea ref={ref} rows={1} value={block.text ?? ""}
    aria-label={block.type === "heading" ? "見出し" : block.type === "quote" ? "引用文" : "本文の文章"}
    placeholder={block.type === "heading" ? "見出し" : block.type === "quote" ? "引用する文章" : "本文を書いてみましょう"}
    maxLength={block.type === "heading" ? 500 : 20000}
    onChange={event => onChange({ ...block, text: event.target.value })}
    onKeyDown={event => {
      if (!onSplit || event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      onSplit(event.currentTarget.selectionStart, event.currentTarget.selectionEnd);
    }}
    onPaste={event => {
      if (!onSplit || block.text?.trim()) return;
      const url = event.clipboardData.getData("text/plain").trim();
      if (!/^https:\/\/\S+$/.test(url)) return;
      try { new URL(url); } catch { return; }
      event.preventDefault();
      onChange({ id: block.id, type: "link", url, title: "" });
    }}
    style={{ fontSize: block.type === "heading" ? (block.level === 3 ? "1.25rem" : "1.5rem") : "1.0625rem", fontWeight: block.type === "heading" ? 700 : 400 }}
    className="block min-h-12 w-full resize-none overflow-hidden border-0 bg-transparent py-2 leading-8 text-[var(--mikke-text)] outline-none placeholder:text-[var(--mikke-muted)]" />;
}

/** Only fields supported by the current cloud publication contract are offered. */
export function MediaCloudBlockFields({ block, onChange, onSplit }: {
  block: MediaBlock; onChange: (block: MediaBlock) => void;
  onSplit: (start: number, end: number) => void;
}) {
  if (block.type === "divider") return <hr className="my-5 border-[var(--mikke-line)]" />;
  if (block.type === "paragraph" || block.type === "heading") return <InlineText block={block} onChange={onChange} onSplit={onSplit} />;
  if (block.type === "image") return <div className="space-y-2">
    <MediaImagePicker sourceApp="media-article" compact currentUrl={block.imageUrl}
      onSelect={asset => onChange({ ...block, imageUrl: asset.publicUrl, imageAssetId: asset.id, alt: block.alt || asset.originalName })} />
    <label className="block text-xs font-semibold">画像の内容（読み上げ用）<input value={block.alt ?? ""} maxLength={500} onChange={event => onChange({ ...block, alt: event.target.value })} className={inputClass} /></label>
    <label className="block text-xs font-semibold">写真の下に表示するひとこと（任意）<input value={block.caption ?? ""} maxLength={1000} onChange={event => onChange({ ...block, caption: event.target.value })} className={inputClass} /></label>
  </div>;
  if (block.type === "quote") return <blockquote className="border-l-4 border-[var(--mikke-primary)] pl-4">
    <InlineText block={block} onChange={onChange} />
    <input aria-label="引用元" placeholder="引用元の名前やURL" value={block.attribution ?? ""} maxLength={500} onChange={event => onChange({ ...block, attribution: event.target.value })} className={inputClass} />
  </blockquote>;
  if (block.type === "list") {
    const items = block.items?.length ? block.items : [""];
    return <div><ul className="space-y-1 pl-1">{items.map((item, index) => <li key={index} className="flex gap-2"><span aria-hidden className="pt-2">•</span><textarea rows={1} aria-label={`箇条書き ${index + 1}`} value={item} maxLength={2000} onChange={event => {
      const next = [...items]; next[index] = event.target.value; onChange({ ...block, items: next });
    }} className="min-w-0 flex-1 resize-y border-0 bg-transparent py-2 leading-7 text-[var(--mikke-text)] outline-none" /></li>)}</ul><button type="button" disabled={items.length >= 100} onClick={() => onChange({ ...block, items: [...items, ""] })} className="py-1 text-sm text-[var(--mikke-primary)] disabled:opacity-40">＋ 項目を追加</button></div>;
  }
  if (block.type === "link") return <div className="space-y-2">
    <label className="block text-xs font-semibold">リンク先URL<input type="url" placeholder="https://" value={block.url ?? ""} maxLength={2048} onChange={event => onChange({ ...block, url: event.target.value })} className={inputClass} /></label>
    <label className="block text-xs font-semibold">表示名（任意）<input value={block.title ?? ""} maxLength={500} onChange={event => onChange({ ...block, title: event.target.value })} className={inputClass} /></label>
  </div>;
  return null;
}
