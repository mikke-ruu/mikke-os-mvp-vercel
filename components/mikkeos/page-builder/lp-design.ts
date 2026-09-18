import type { MikkeContentBlock } from "@/lib/mikkeos/content/types";
import type { PageJpFontId } from "@/lib/page/types";

// LP-only metadata: the article/lesson schema and existing blocks remain intact.
export type LpStyle = {
  font?: PageJpFontId; size?: number; lineHeight?: number; letterSpacing?: number;
  color?: string; background?: string; padding?: number; gap?: number;
  radius?: number; border?: string; shadow?: boolean; columns?: 1 | 2 | 3;
};
export type LpBlock = MikkeContentBlock & { lp?: {
  reference?: { kind: string; id: string; imageSide?: "left" | "right" };
  desktop?: LpStyle; mobile?: LpStyle; children?: LpBlock[]; template?: "faq";
  motion?: "none" | "fade" | "rise";
  slideshow?: boolean; autoplay?: boolean; backgroundImage?: string;
} };

export function newLpSection(): LpBlock {
  return { id: crypto.randomUUID(), type: "paragraph", text: "", lp: {
    desktop: { padding: 24, gap: 16, background: "#f5f5f5", radius: 12, columns: 1 },
    children: [{ id: crypto.randomUUID(), type: "heading", text: "見出し", level: 2 },
      { id: crypto.randomUUID(), type: "paragraph", text: "伝えたい内容を入力してください。" }],
  } };
}

export function lpFonts(blocks: LpBlock[]): PageJpFontId[] {
  return [...new Set(blocks.flatMap(b => [b.lp?.desktop?.font, b.lp?.mobile?.font,
    ...lpFonts(b.lp?.children ?? [])]).filter((f): f is PageJpFontId => Boolean(f)))];
}

export function safeLpColor(value?: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
}

export function uniqueLpIds(blocks: LpBlock[]): LpBlock[] {
  const seen = new Set<string>();
  const walk = (items: LpBlock[]): LpBlock[] => items.map(b => {
    const id = seen.has(b.id) ? crypto.randomUUID() : b.id; seen.add(id);
    return { ...b, id, ...(b.lp ? { lp: { ...b.lp, ...(b.lp.children ? { children: walk(b.lp.children) } : {}) } } : {}) };
  });
  return walk(blocks);
}

export function bounded(value: number | undefined, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : undefined;
}

export function applyLpTheme(blocks: LpBlock[], theme: "natural" | "clear" | "classic"): LpBlock[] {
  const palette = {
    natural: { background: "#fff8ed", color: "#684326", font: "zen-maru" as const },
    clear: { background: "#f0f7fb", color: "#204b62", font: "noto-sans" as const },
    classic: { background: "#f5f2ee", color: "#423b36", font: "noto-serif" as const },
  }[theme];
  return blocks.map(block => ({ ...block, lp: { ...block.lp,
    desktop: { ...block.lp?.desktop, ...palette, padding: 20, radius: 8,
      ...(block.type === "heading" ? { size: 30, lineHeight: 1.4 } : {}) },
    mobile: { ...block.lp?.mobile, padding: 16, ...(block.type === "heading" ? { size: 24 } : {}) },
    ...(block.lp?.children ? { children: applyLpTheme(block.lp.children, theme) } : {}),
  } }));
}
// Uploaded Academy images use HTTPS; local previews may use raster data URLs.
export function lpBackground(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^data:image\/(webp|png|jpeg);base64,[a-z0-9+/=]+$/i.test(value)) return `url(${JSON.stringify(value)})`;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return `url(${JSON.stringify(url.href)})`;
  } catch { /* Invalid URLs are not rendered. */ }
  return undefined;
}
