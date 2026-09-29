"use client";
import type { ComponentType } from "react";
import type { LpBlock } from "@/components/mikkeos/page-builder/lp-design";
import { LpMediaFields } from "@/components/mikkeos/page-builder/LpMediaFields";
import type { ContentImagePickerProps } from "@/components/mikkeos/content/MikkeBlockFields";
import styles from "@/components/mikkeos/content/image-editing.module.css";
export function AcademyImageFields({ block, onChange, ImagePicker }: { block: LpBlock; onChange: (block: LpBlock) => void; ImagePicker: ComponentType<ContentImagePickerProps> }) {
  return <div className={styles.root}>
    {block.imageUrl && <figure className={styles.preview}><img src={block.imageUrl} alt={block.alt ?? ""} style={{width: `${block.lp?.media?.width ?? 100}%`, objectFit: block.lp?.media?.fit ?? "contain"}}/></figure>}
    <label>画像の下の説明<textarea rows={2} placeholder="キャプションを入力" value={block.caption ?? ""} onChange={event => onChange({ ...block, caption: event.target.value })}/></label>
    <LpMediaFields block={block} onChange={onChange}/>
    <details key={block.imageUrl} open={!block.imageUrl}><summary>{block.imageUrl ? "画像を差し替える" : "画像を選ぶ"}</summary><ImagePicker currentUrl={block.imageUrl} onSelect={asset => onChange({ ...block, imageUrl: asset.publicUrl, ...(asset.id ? { imageAssetId: asset.id } : {}) })}/></details>
    <details><summary>リンク・読み上げ用の説明</summary><label>画像のリンク先URL<input type="url" value={block.imageLink ?? ""} onChange={event => onChange({ ...block, imageLink: event.target.value })}/></label><label>画像の内容（読み上げ用）<input value={block.alt ?? ""} onChange={event => onChange({ ...block, alt: event.target.value })}/></label></details>
  </div>;
}
