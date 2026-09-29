"use client";
import { LpContent } from "@/components/mikkeos/page-builder/LpDesign";
import type { LpBlock } from "@/components/mikkeos/page-builder/lp-design";
import { AcademyLpRenderer } from "./AcademyLpRenderer";

export function AcademyLpContent({ blocks }: { blocks: LpBlock[] }) {
  return <LpContent standaloneButtons blocks={blocks} render={items => <AcademyLpRenderer blocks={items}/>}/>;
}
