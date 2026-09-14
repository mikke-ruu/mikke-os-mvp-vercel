"use client";
import { MikkeContentEditor } from "@/components/mikkeos/content/MikkeContentEditor";
import { MikkeBlockFields, type ContentImagePickerProps } from "@/components/mikkeos/content/MikkeBlockFields";
import type { MikkeContentBlock } from "@/lib/mikkeos/content/types";
import type { AcademyPageBlock } from "@/types/database";
import { academyContent, replaceAcademyContent } from "@/lib/academy/content-adapter";
import { AcademyImageUploader } from "./AcademyImageUploader";

function ImagePicker({currentUrl,onSelect}:ContentImagePickerProps) {
  return <AcademyImageUploader compact currentUrl={currentUrl} onUploaded={publicUrl=>onSelect({publicUrl})}/>;
}
function LinkEditor({block,onChange}:{block:MikkeContentBlock;onChange:(block:MikkeContentBlock)=>void}) {
  return <div className="space-y-3"><label className="block text-sm">{block.type === "video" ? "動画のURL" : "リンク先のURL"}<input type="url" value={block.url ?? ""} placeholder="https://" onChange={e=>onChange({...block,url:e.target.value})} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] p-3"/></label><label className="block text-sm">表示する名前<input value={block.title ?? ""} onChange={e=>onChange({...block,title:e.target.value})} className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] p-3"/></label></div>;
}
export function AcademyContentEditor({blocks,onChange}:{blocks:AcademyPageBlock[];onChange:(blocks:AcademyPageBlock[])=>void}) {
  return <MikkeContentEditor blocks={academyContent(blocks)} onChange={next=>onChange(replaceAcademyContent(blocks,next))} renderBlock={(block,change,split)=><MikkeBlockFields block={block} onChange={change} onSplit={split} ImagePicker={ImagePicker} LinkEditor={LinkEditor}/>}/>;
}
