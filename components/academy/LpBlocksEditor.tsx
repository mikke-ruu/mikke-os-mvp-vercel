"use client";
import type { AcademyLpBlock } from "@/types/database";
import { AcademyContentEditor } from "./AcademyContentEditor";
import { academyContent, contentToAcademy } from "@/lib/academy/content-adapter";
import { EditorPreview } from "./EditorPreview";
import { PageBlocks } from "./PageBlocks";
export function LpBlocksEditor({blocks,onChange}:{blocks:AcademyLpBlock[];onChange:(blocks:AcademyLpBlock[])=>void}) {
  return <EditorPreview preview={<><p className="mb-4 text-xs text-[var(--mikke-muted)]">追加コンテンツのプレビューです。基本情報と申込フォームは公開ページで確認できます。</p><PageBlocks blocks={blocks}/></>}>
    <AcademyContentEditor blocks={blocks} onChange={next=>onChange(contentToAcademy(academyContent(next)))}/>
  </EditorPreview>;
}
