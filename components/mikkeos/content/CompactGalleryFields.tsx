"use client";
import { useRef, useState, type ReactNode } from "react";
import type { MikkeContentBlock } from "@/lib/mikkeos/content/types";
import styles from "./image-editing.module.css";
type Images = NonNullable<MikkeContentBlock["images"]>;
export function CompactGalleryFields({ images, onChange, pickImage, sizeEditor }: { sizeEditor?: ReactNode; images: Images; onChange: (images: Images) => void; pickImage: (url: string, change: (url: string, assetId?: string) => void) => ReactNode }) {
  const [mode, setMode] = useState<"image" | "size">("image");
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(0, images.length - 1));
  const image = images[index];
  const latest = useRef(images); latest.current = images;
  const patch = (change: Partial<Images[number]>) => onChange(latest.current.map((item, i) => i === index ? { ...item, ...change } : item));
  const move = (direction: number) => { const next = [...images], target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; onChange(next); setSelected(target); };
  return <div className={styles.root}>
    {sizeEditor && <div className={styles.actions} role="group" aria-label="画像の編集方法"><button type="button" aria-pressed={mode === "image"} onClick={() => setMode("image")}>画像・説明</button><button type="button" aria-pressed={mode === "size"} onClick={() => setMode("size")}>大きさを調整</button></div>}
    {mode === "size" ? sizeEditor : <>
    <div className={styles.thumbnails} role="group" aria-label="編集する画像を選択">
      {images.map((item, i) => <button key={i} type="button" aria-label={`画像 ${i + 1} を編集`} aria-pressed={i === index} onClick={() => setSelected(i)}>{item.url ? <img src={item.url} alt=""/> : <span>画像なし</span>}<small>{i + 1}</small></button>)}

    </div>
    <div className={styles.actions}><button type="button" onClick={() => { onChange([...images, { url: "", alt: "" }]); setSelected(images.length); }} aria-label="画像を追加">＋ 画像を追加</button></div>
    {image ? <section className={styles.selected} aria-label={`画像 ${index + 1} の編集`}>
      <p className={styles.counter}>{index + 1} / {images.length} 枚目を編集中</p>
      {image.url && <figure className={styles.preview}><img src={image.url} alt={image.alt}/></figure>}
      <label>画像の説明<textarea rows={2} placeholder="画像の下に表示する説明" value={image.caption ?? image.alt ?? ""} onChange={event => patch({ alt: event.target.value, caption: event.target.value })}/></label>
      <details key={`${index}:${image.url}`} open={!image.url}><summary>{image.url ? "画像を差し替える" : "画像を選ぶ"}</summary>{pickImage(image.url, (url, assetId) => patch({ url, ...(assetId ? { assetId } : {}) }))}</details>
      <details><summary>リンク先を設定{image.href ? "（設定済み）" : ""}</summary><label>リンク先URL（任意）<input type="url" placeholder="https://" value={image.href ?? ""} onChange={event => patch({ href: event.target.value })}/></label></details>
      <div className={styles.actions}><button type="button" disabled={index === 0} onClick={() => move(-1)}>← 前へ</button><button type="button" disabled={index === images.length - 1} onClick={() => move(1)}>次へ →</button><button type="button" onClick={() => { onChange(images.filter((_, i) => i !== index)); setSelected(Math.max(0, index - 1)); }}>この画像を削除</button></div>
    </section> : <p>「＋」から画像を追加できます。</p>}
    </>}
  </div>;
}
