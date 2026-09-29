import type { AcademyLpBlock } from "@/types/database";

export type AcademyFrontDesign = {
  version: 1;
  width: "standard" | "wide" | "full";
  hero: "split" | "stack" | "slides" | "hidden";
  slides: { url: string; alt: string }[];
};
export const defaultFrontDesign: AcademyFrontDesign = { version: 1, width: "standard", hero: "split", slides: [] };
// Presentation metadata lives in the existing JSON document. Its empty text
// projection stays harmless for legacy readers; keep it outside the body editor.
type SettingsBlock = AcademyLpBlock & { academyFrontDesign?: AcademyFrontDesign };
export function readFrontDocument(blocks: AcademyLpBlock[] = []) {
  const metadata = (blocks as SettingsBlock[]).find(block => block.academyFrontDesign?.version === 1);
  const raw = metadata?.academyFrontDesign;
  const design: AcademyFrontDesign = {
    version: 1,
    width: raw && ["standard", "wide", "full"].includes(raw.width) ? raw.width : "standard",
    hero: raw && ["split", "stack", "slides", "hidden"].includes(raw.hero) ? raw.hero : "split",
    slides: Array.isArray(raw?.slides) ? raw.slides.filter(slide => typeof slide?.url === "string").map(slide => ({ url: slide.url, alt: typeof slide.alt === "string" ? slide.alt : "" })) : [],
  };
  return { design, blocks: blocks.filter(block => block !== metadata) };
}
export function writeFrontDocument(blocks: AcademyLpBlock[], design: AcademyFrontDesign): AcademyLpBlock[] {
  const metadata: SettingsBlock = { type: "text", text: "", academyFrontDesign: structuredClone(design) };
  return [metadata, ...readFrontDocument(blocks).blocks];
}
export function frontMaxWidth(design: AcademyFrontDesign, legacy = 1024) {
  return design.width === "full" ? "100%" : design.width === "wide" ? 1440 : legacy;
}
