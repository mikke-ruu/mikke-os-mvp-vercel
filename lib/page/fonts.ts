import type { PageBlock, PageJpFontId, PageLatinFontId, PageSiteTheme } from "./types";

export type PageFontCatalogEntry = {
  id: string;
  label: string;
  helper: string;
  /** Google Fonts css2 APIのfamilyパラメータ値（スペースは+） */
  googleFamily: string;
  /** CSS font-familyチェーンに差し込む値（必要なら引用符つき） */
  cssFamily: string;
  /** css2のwght軸に渡すウェイト一覧 */
  weights: string;
};

export const pageJpFonts: Record<PageJpFontId, PageFontCatalogEntry> = {
  "noto-sans": { id: "noto-sans", label: "Noto Sans JP", helper: "定番ゴシック", googleFamily: "Noto+Sans+JP", cssFamily: '"Noto Sans JP"', weights: "400;500;700;900" },
  "noto-serif": { id: "noto-serif", label: "Noto Serif JP", helper: "明朝", googleFamily: "Noto+Serif+JP", cssFamily: '"Noto Serif JP"', weights: "400;500;700;900" },
  "zen-kaku": { id: "zen-kaku", label: "Zen Kaku Gothic New", helper: "やわらかゴシック", googleFamily: "Zen+Kaku+Gothic+New", cssFamily: '"Zen Kaku Gothic New"', weights: "400;500;700;900" },
  "zen-old": { id: "zen-old", label: "Zen Old Mincho", helper: "クラシック明朝", googleFamily: "Zen+Old+Mincho", cssFamily: '"Zen Old Mincho"', weights: "400;500;600;700;900" },
  "zen-maru": { id: "zen-maru", label: "Zen Maru Gothic", helper: "丸ゴシック", googleFamily: "Zen+Maru+Gothic", cssFamily: '"Zen Maru Gothic"', weights: "400;500;700;900" },
  "mplus-round": { id: "mplus-round", label: "M PLUS Rounded 1c", helper: "ポップ丸ゴ", googleFamily: "M+PLUS+Rounded+1c", cssFamily: '"M PLUS Rounded 1c"', weights: "400;500;700;900" },
  shippori: { id: "shippori", label: "Shippori Mincho", helper: "上品明朝", googleFamily: "Shippori+Mincho", cssFamily: '"Shippori Mincho"', weights: "400;500;600;700;800" },
  "biz-ud": { id: "biz-ud", label: "BIZ UDPGothic", helper: "読みやすさ重視", googleFamily: "BIZ+UDPGothic", cssFamily: '"BIZ UDPGothic"', weights: "400;700" }
};

export const pageJpFontOrder: PageJpFontId[] = ["noto-sans", "noto-serif", "zen-kaku", "zen-old", "zen-maru", "mplus-round", "shippori", "biz-ud"];

export const pageLatinFonts: Record<PageLatinFontId, PageFontCatalogEntry> = {
  none: { id: "none", label: "なし（日本語フォントに任せる）", helper: "", googleFamily: "", cssFamily: "", weights: "" },
  inter: { id: "inter", label: "Inter", helper: "モダンサンセリフ", googleFamily: "Inter", cssFamily: "Inter", weights: "400;500;600;700;800" },
  montserrat: { id: "montserrat", label: "Montserrat", helper: "幾何学サンセリフ", googleFamily: "Montserrat", cssFamily: "Montserrat", weights: "400;500;600;700;800" },
  poppins: { id: "poppins", label: "Poppins", helper: "丸みサンセリフ", googleFamily: "Poppins", cssFamily: "Poppins", weights: "400;500;600;700;800" },
  playfair: { id: "playfair", label: "Playfair Display", helper: "高級セリフ", googleFamily: "Playfair+Display", cssFamily: '"Playfair Display"', weights: "400;500;600;700;800" },
  cormorant: { id: "cormorant", label: "Cormorant Garamond", helper: "細身クラシック", googleFamily: "Cormorant+Garamond", cssFamily: '"Cormorant Garamond"', weights: "400;500;600;700" },
  "dm-serif": { id: "dm-serif", label: "DM Serif Display", helper: "大見出し向けセリフ", googleFamily: "DM+Serif+Display", cssFamily: '"DM Serif Display"', weights: "400" },
  josefin: { id: "josefin", label: "Josefin Sans", helper: "細身レトロモダン", googleFamily: "Josefin+Sans", cssFamily: '"Josefin Sans"', weights: "400;500;600;700" },
  caveat: { id: "caveat", label: "Caveat", helper: "手書き風", googleFamily: "Caveat", cssFamily: "Caveat", weights: "400;500;600;700" }
};

export const pageLatinFontOrder: PageLatinFontId[] = ["none", "inter", "montserrat", "poppins", "playfair", "cormorant", "dm-serif", "josefin", "caveat"];

const genericFallbackChain = '"Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';

/**
 * 日本語フォントID・欧文フォントIDからfont-familyチェーンを組み立てる。
 * どちらも未指定のときは旧仕様の文字列（legacyFallback）をそのまま使う。
 */
export function buildPageFontFamily(
  jpFontId: PageJpFontId | undefined,
  latinFontId: PageLatinFontId | undefined,
  legacyFallback: string
): string {
  const jp = jpFontId ? pageJpFonts[jpFontId] : undefined;
  const latin = latinFontId && latinFontId !== "none" ? pageLatinFonts[latinFontId] : undefined;
  if (!jp && !latin) return legacyFallback || genericFallbackChain;
  const chain: string[] = [];
  if (latin?.cssFamily) chain.push(latin.cssFamily);
  if (jp?.cssFamily) chain.push(jp.cssFamily);
  chain.push(genericFallbackChain);
  return chain.join(", ");
}

export function resolvePageThemeFonts(theme: PageSiteTheme): { heading: string; body: string } {
  return {
    heading: buildPageFontFamily(theme.headingJpFontId, theme.headingLatinFontId, theme.headingFont),
    body: buildPageFontFamily(theme.bodyJpFontId, theme.bodyLatinFontId, theme.bodyFont)
  };
}

/** サイトテーマ＋各ブロックのフォント上書きから、実際に読み込みが必要なフォントIDを集約する */
export function collectPageUsedFontIds(theme: PageSiteTheme, blocks: PageBlock[] = []): { jp: PageJpFontId[]; latin: PageLatinFontId[] } {
  const jp = new Set<PageJpFontId>();
  const latin = new Set<PageLatinFontId>();
  if (theme.headingJpFontId) jp.add(theme.headingJpFontId);
  if (theme.bodyJpFontId) jp.add(theme.bodyJpFontId);
  if (theme.headingLatinFontId && theme.headingLatinFontId !== "none") latin.add(theme.headingLatinFontId);
  if (theme.bodyLatinFontId && theme.bodyLatinFontId !== "none") latin.add(theme.bodyLatinFontId);
  for (const block of blocks) {
    if (block.style?.jpFontId) jp.add(block.style.jpFontId);
    if (block.style?.latinFontId && block.style.latinFontId !== "none") latin.add(block.style.latinFontId);
  }
  return { jp: [...jp], latin: [...latin] };
}

/** Google Fonts css2 APIの<link>用URLを1本生成する（該当フォントがなければnull） */
export function buildPageFontsCssUrl(jpIds: PageJpFontId[], latinIds: PageLatinFontId[]): string | null {
  const seen = new Set<string>();
  const families: string[] = [];
  for (const id of jpIds) {
    const font = pageJpFonts[id];
    if (!font?.googleFamily || seen.has(font.googleFamily)) continue;
    seen.add(font.googleFamily);
    families.push(`family=${font.googleFamily}:wght@${font.weights}`);
  }
  for (const id of latinIds) {
    if (id === "none") continue;
    const font = pageLatinFonts[id];
    if (!font?.googleFamily || seen.has(font.googleFamily)) continue;
    seen.add(font.googleFamily);
    families.push(`family=${font.googleFamily}:wght@${font.weights}`);
  }
  if (!families.length) return null;
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}
