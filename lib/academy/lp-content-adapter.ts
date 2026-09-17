import type { AcademyLpBlock } from "@/types/database";
import type { LpBlock } from "@/components/mikkeos/page-builder/lp-design";
import { academyContent, contentToAcademy } from "./content-adapter";

function fallbackText(block: LpBlock): string {
  if (block.lp?.children) return block.lp.children.map(fallbackText).filter(Boolean).join("\n\n");
  return [block.title, block.text, ...(block.items ?? []), block.imageUrl, block.url,
    ...(block.images ?? []).map(image => [image.caption, image.url].filter(Boolean).join(" ")),
    ...(block.links ?? []).map(link => [link.label, link.url].filter(Boolean).join(" ")),
  ].filter(Boolean).join("\n");
}

// Preserve unrelated JSON fields on existing blocks. New containers retain a
// readable legacy projection, so a code rollback does not hide all their text.
export function saveAcademyLpContent(original: AcademyLpBlock[], next: LpBlock[]): AcademyLpBlock[] {
  const previous = new Map(academyContent(original).map((block, index) => [block.id, original[index]]));
  return contentToAcademy(next).map((block, index) => {
    const content = next[index];
    const text = fallbackText(content);
    const projected = content.lp?.children ? { ...block, type: "text" as const, text, content: { ...content, type: "paragraph" as const, text } } : block;
    return { ...previous.get(content.id), ...projected } as AcademyLpBlock;
  });
}
