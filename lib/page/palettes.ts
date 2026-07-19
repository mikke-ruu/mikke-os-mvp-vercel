import type { PageSiteTheme } from "./types";

export type PagePaletteId = "p01" | "p02" | "p03" | "p04" | "p05" | "p06" | "p07" | "p08" | "p09" | "p10";

export type PagePalette = {
  id: PagePaletteId;
  name: string;
  backgroundColor: string;
  textColor: string;
  primaryColor: string;
  accentColor: string;
  dark?: boolean;
};

export const pagePalettes: PagePalette[] = [
  { id: "p01", name: "しろがさね", backgroundColor: "#ffffff", textColor: "#2a2e35", primaryColor: "#3b4252", accentColor: "#e08a5a" },
  { id: "p02", name: "きなり", backgroundColor: "#faf6f0", textColor: "#4a3f38", primaryColor: "#b0674a", accentColor: "#d99c73" },
  { id: "p03", name: "らて", backgroundColor: "#f8f4ee", textColor: "#443c34", primaryColor: "#8a6f57", accentColor: "#c2a382" },
  { id: "p04", name: "せーじ", backgroundColor: "#f6f8f4", textColor: "#35413a", primaryColor: "#5f7a68", accentColor: "#a3b899" },
  { id: "p05", name: "みずいろ", backgroundColor: "#f4f7fa", textColor: "#313b47", primaryColor: "#5b7c99", accentColor: "#9db8cf" },
  { id: "p06", name: "もーゔ", backgroundColor: "#f9f6fb", textColor: "#3f3646", primaryColor: "#7d6493", accentColor: "#b79fc7" },
  { id: "p07", name: "さくら", backgroundColor: "#fdf6f6", textColor: "#4a3a3c", primaryColor: "#b96a76", accentColor: "#e3aab2" },
  { id: "p08", name: "はちみつ", backgroundColor: "#fdfaf1", textColor: "#45402f", primaryColor: "#c19a3f", accentColor: "#e4c568" },
  { id: "p09", name: "しんりょく", backgroundColor: "#f4f6f4", textColor: "#2c3a31", primaryColor: "#34523f", accentColor: "#c99b5f" },
  { id: "p10", name: "よる", backgroundColor: "#16181d", textColor: "#f2f3f5", primaryColor: "#e9e4da", accentColor: "#d99c73", dark: true }
];

export const defaultPagePalette = pagePalettes[0];

export function findPagePalette(id: string | undefined | null): PagePalette | undefined {
  return pagePalettes.find((palette) => palette.id === id);
}

/** 現在のテーマ4色がどのパレットと完全一致するかを調べる（選択UIのハイライト用。一致しなければnull＝カスタム扱い） */
export function findMatchingPagePaletteId(theme: Pick<PageSiteTheme, "backgroundColor" | "textColor" | "primaryColor" | "accentColor">): PagePaletteId | null {
  const match = pagePalettes.find((palette) =>
    palette.backgroundColor.toLowerCase() === (theme.backgroundColor ?? "").toLowerCase() &&
    palette.textColor.toLowerCase() === (theme.textColor ?? "").toLowerCase() &&
    palette.primaryColor.toLowerCase() === (theme.primaryColor ?? "").toLowerCase() &&
    palette.accentColor.toLowerCase() === (theme.accentColor ?? "").toLowerCase()
  );
  return match?.id ?? null;
}

export function applyPagePaletteToTheme(theme: PageSiteTheme, palette: PagePalette): PageSiteTheme {
  return {
    ...theme,
    backgroundColor: palette.backgroundColor,
    textColor: palette.textColor,
    primaryColor: palette.primaryColor,
    accentColor: palette.accentColor
  };
}
