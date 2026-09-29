"use client";
import type { ComponentType } from "react";

import { LpCanvas } from "@/components/mikkeos/page-builder/LpCanvas";
import { LpDesignFields } from "@/components/mikkeos/page-builder/LpDesign";
import { LpGalleryFields } from "@/components/mikkeos/page-builder/LpGalleryFields";
import { LpRichWriting } from "@/components/mikkeos/page-builder/LpRichWriting";
import { MikkeBlockFields, type ContentImagePickerProps } from "@/components/mikkeos/content/MikkeBlockFields";
import type { LpBlock } from "@/components/mikkeos/page-builder/lp-design";
import { academyContent } from "@/lib/academy/content-adapter";
import { saveAcademyLpContent } from "@/lib/academy/lp-content-adapter";
import type { AcademyLpBlock } from "@/types/database";
import { AcademyImageUploader } from "./AcademyImageUploader";
import { AcademyLpRenderer } from "./AcademyLpRenderer";

import { LpButtonFields } from "@/components/mikkeos/page-builder/LpButtonFields";
import { AcademyImageFields } from "./AcademyImageFields";
import { LpMediaFields } from "@/components/mikkeos/page-builder/LpMediaFields";

function AcademyLpImagePicker({ currentUrl, onSelect }: ContentImagePickerProps) {
  return <div><AcademyImageUploader compact currentUrl={currentUrl} onUploaded={publicUrl => onSelect({ publicUrl })}/>{currentUrl && <button type="button" onClick={() => onSelect({ publicUrl: "" })}>画像を外す</button>}</div>;
}

function LinkEditor({ block, onChange }: { block: LpBlock; onChange: (block: LpBlock) => void }) {
  return <div><label>{block.type === "video" ? "動画URL（YouTube・MP4など）" : "リンク先URL"}<input type="url" value={block.url ?? ""} onChange={e => onChange({ ...block, url: e.target.value })}/></label><label>表示名<input value={block.title ?? ""} onChange={e => onChange({ ...block, title: e.target.value })}/></label></div>;
}

// Keep the existing HQ JSON field and its versioned, legacy-compatible payload.
// This editor never owns publication, tenant identity, or payment configuration.
export function AcademyLpEditor({ blocks, onChange, title, previewMaxWidth, ImagePicker = AcademyLpImagePicker }: { blocks: AcademyLpBlock[]; onChange: (blocks: AcademyLpBlock[]) => void; title: string; previewMaxWidth?: number | string; ImagePicker?: ComponentType<ContentImagePickerProps> }) {
  return <LpCanvas allowMediaParts extraTemplates={[{ label: "動画", description: "YouTubeの動画を表示", create: () => ({id: crypto.randomUUID(), type: "video", url: ""}) }, {label: "区切り線", description: "内容の間に線を入れる", create: () => ({id: crypto.randomUUID(), type: "divider"})}, {label: "画像スライド", description: "複数の画像を切り替えて表示", create: () => ({id: crypto.randomUUID(), type: "gallery", images: [], lp: {slideshow: true}})}]} previewMaxWidth={previewMaxWidth} title={title} pageLabel="ホームページの本文" blocks={academyContent(blocks)} onChange={next => onChange(saveAcademyLpContent(blocks, next))}
    renderContent={items => <AcademyLpRenderer blocks={items}/>}
    renderFields={(block, change, tab) => {
      if (block.type === "cta") return <LpButtonFields block={block} onChange={change} tab={tab}/>;
      if (tab === "design") return <>{["image", "gallery", "video"].includes(block.type) && <LpMediaFields block={block} onChange={change}/>}<LpDesignFields block={block} onChange={change} expanded imagePicker={<ImagePicker currentUrl={block.lp?.backgroundImage} onSelect={asset => change({ ...block, lp: { ...block.lp, backgroundImage: asset.publicUrl } })}/>}/></>;
      if (block.type === "image") return <AcademyImageFields block={block} onChange={change} ImagePicker={ImagePicker}/>;
      if (block.type === "gallery") return <LpGalleryFields block={block} onChange={change} ImagePicker={ImagePicker}/>;
      if (block.type === "heading" || block.type === "paragraph") return <LpRichWriting compact block={block} onChange={change}/>;
      return <MikkeBlockFields block={block} onChange={change} onSplit={() => {}} ImagePicker={ImagePicker} LinkEditor={LinkEditor}/>;
    }}/>;
}
