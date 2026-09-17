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
import { AcademyContentRenderer } from "./AcademyContentRenderer";

function AcademyLpImagePicker({ currentUrl, onSelect }: ContentImagePickerProps) {
  return <div><AcademyImageUploader compact currentUrl={currentUrl} onUploaded={publicUrl => onSelect({ publicUrl })}/>{currentUrl && <button type="button" onClick={() => onSelect({ publicUrl: "" })}>画像を外す</button>}</div>;
}

function LinkEditor({ block, onChange }: { block: LpBlock; onChange: (block: LpBlock) => void }) {
  return <div><label>リンク先URL<input type="url" value={block.url ?? ""} onChange={e => onChange({ ...block, url: e.target.value })}/></label><label>表示名<input value={block.title ?? ""} onChange={e => onChange({ ...block, title: e.target.value })}/></label></div>;
}

// Keep the existing HQ JSON field and its versioned, legacy-compatible payload.
// This editor never owns publication, tenant identity, or payment configuration.
export function AcademyLpEditor({ blocks, onChange, title, ImagePicker = AcademyLpImagePicker }: { blocks: AcademyLpBlock[]; onChange: (blocks: AcademyLpBlock[]) => void; title: string; ImagePicker?: ComponentType<ContentImagePickerProps> }) {
  return <LpCanvas title={title} pageLabel="ホームページの本文" blocks={academyContent(blocks)} onChange={next => onChange(saveAcademyLpContent(blocks, next))}
    renderContent={items => <AcademyContentRenderer blocks={items}/>}
    renderFields={(block, change, tab) => {
      if (tab === "design") return <LpDesignFields block={block} onChange={change} expanded imagePicker={<ImagePicker currentUrl={block.lp?.backgroundImage} onSelect={asset => change({ ...block, lp: { ...block.lp, backgroundImage: asset.publicUrl } })}/>}/>;
      if (block.type === "gallery") return <LpGalleryFields block={block} onChange={change} ImagePicker={ImagePicker}/>;
      if (block.type === "heading" || block.type === "paragraph") return <LpRichWriting compact block={block} onChange={change}/>;
      return <MikkeBlockFields block={block} onChange={change} onSplit={() => {}} ImagePicker={ImagePicker} LinkEditor={LinkEditor}/>;
    }}/>;
}
