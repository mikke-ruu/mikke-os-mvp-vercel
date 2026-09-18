"use client";
import type { ComponentType } from "react";
import type { ContentImagePickerProps } from "../content/MikkeBlockFields";
import type { LpBlock } from "./lp-design";

export function LpGalleryFields({ block, onChange, ImagePicker }: { block: LpBlock; onChange: (block: LpBlock) => void; ImagePicker: ComponentType<ContentImagePickerProps> }) {
  const images = block.images ?? [];
  const mode = block.lp?.slideshow ? block.lp.autoplay ? "auto" : "slide" : String(block.columns ?? 3);
  return <div>
    <label>表示<select value={mode} onChange={e => {
      const value = e.target.value;
      onChange({ ...block, columns: value === "2" ? 2 : value === "3" ? 3 : block.columns, lp: { ...block.lp, slideshow: value === "slide" || value === "auto", autoplay: value === "auto" } });
    }}><option value="2">2列</option><option value="3">3列</option><option value="slide">スライド</option><option value="auto">スライド自動再生（5秒）</option></select></label>
    {images.map((image, index) => <fieldset key={index} style={{ border: "1px solid var(--mikke-line)", borderRadius: 8, padding: 10, marginTop: 12 }}>
      <legend>画像 {index + 1}</legend>
      <ImagePicker currentUrl={image.url} onSelect={asset => onChange({ ...block, images: asset.publicUrl ? images.map((item, i) => i === index ? { ...item, url: asset.publicUrl } : item) : images.filter((_, i) => i !== index) })}/>
      <label>画像の説明<input value={image.alt} onChange={e => onChange({ ...block, images: images.map((item, i) => i === index ? { ...item, alt: e.target.value } : item) })}/></label>
      <label>リンク先URL（任意）<input type="url" placeholder="https://" value={image.href ?? ""} onChange={e => onChange({ ...block, images: images.map((item, i) => i === index ? { ...item, href: e.target.value } : item) })}/></label>
      <button type="button" disabled={index === 0} onClick={() => { const next = [...images]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange({ ...block, images: next }); }}>前へ</button>
      {!image.url && <button type="button" onClick={() => onChange({ ...block, images: images.filter((_, i) => i !== index) })}>枠を削除</button>}
    </fieldset>)}
    <button type="button" onClick={() => onChange({ ...block, images: [...images, { url: "", alt: "" }] })}>＋ 画像を追加</button>
  </div>;
}
