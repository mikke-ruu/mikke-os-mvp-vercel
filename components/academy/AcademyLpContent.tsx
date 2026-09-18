"use client";
import { LpContent } from "@/components/mikkeos/page-builder/LpDesign";
import type { LpBlock } from "@/components/mikkeos/page-builder/lp-design";
import { AcademyContentRenderer } from "./AcademyContentRenderer";

export function AcademyLpContent({ blocks }: { blocks: LpBlock[] }) {
  return <LpContent blocks={blocks} render={items => <AcademyContentRenderer blocks={items}/>}/>;
}
