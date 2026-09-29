"use client";
import { LpButton } from "@/components/mikkeos/page-builder/LpButton";
import type { LpBlock } from "@/components/mikkeos/page-builder/lp-design";
import { AcademyContentRenderer } from "./AcademyContentRenderer";
export function AcademyLpRenderer({ blocks }: { blocks: LpBlock[] }) {
  return <>{blocks.map(block => block.type === "cta" ? <LpButton key={block.id} block={block}/> : <AcademyContentRenderer presentationHandled key={block.id} blocks={[block]}/>)}</>;
}
