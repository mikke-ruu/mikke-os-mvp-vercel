"use client";
import styles from "../content/image-editing.module.css";
import type { CSSProperties } from "react";
import { CompactGalleryFields } from "../content/CompactGalleryFields";
import { LpMediaFields } from "./LpMediaFields";
import type { ComponentType } from "react";
import type { ContentImagePickerProps } from "../content/MikkeBlockFields";
import type { LpBlock } from "./lp-design";

export function LpGalleryFields({ block, onChange, ImagePicker }: { block: LpBlock; onChange: (block: LpBlock) => void; ImagePicker: ComponentType<ContentImagePickerProps> }) {
  const images = block.images ?? [];
  const mode = block.lp?.slideshow ? block.lp.autoplay ? "auto" : "slide" : String(block.columns ?? 3);
  return <div>
    <label>表示<select className="min-h-11 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2" value={mode} onChange={e => {
      const value = e.target.value;
      onChange({ ...block, columns: value === "2" ? 2 : value === "3" ? 3 : block.columns, lp: { ...block.lp, slideshow: value === "slide" || value === "auto", autoplay: value === "auto" } });
    }}><option value="2">2列</option><option value="3">3列</option><option value="slide">スライド</option><option value="auto">スライド自動再生（5秒）</option></select></label>
    <CompactGalleryFields sizeEditor={<div className={styles.sizePanel}><p>画像一覧全体の大きさを調整します。</p><div className={styles.sizeStage}><div className={styles.sizeBase}><div className={styles.sizeSample} style={{width: `${block.lp?.media?.width ?? 100}%`, marginLeft: block.lp?.media?.align === "left" ? 0 : "auto", marginRight: block.lp?.media?.align === "right" ? 0 : "auto", "--sample-columns": block.lp?.slideshow ? 1 : block.columns ?? 3} as CSSProperties}>{images.filter(image => image.url).slice(0, block.lp?.slideshow ? 1 : 6).map((image,index) => <img key={index} src={image.url} alt="" style={{height: block.lp?.media?.height ? Math.min(140, block.lp.media.height / 3) : undefined, objectFit: block.lp?.media?.fit ?? "cover"}}/>)}</div></div></div><small>サイズの見本{images.length > 6 ? "（先頭の6枚）" : ""}</small><LpMediaFields compact block={block} onChange={onChange}/></div>} images={images} onChange={images => onChange({...block, images})} pickImage={(url, choose) => <ImagePicker currentUrl={url} onSelect={asset => choose(asset.publicUrl, asset.id)}/>}/>

  </div>;
}
