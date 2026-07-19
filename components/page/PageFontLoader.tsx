"use client";

import { useEffect, useMemo } from "react";
import { buildPageFontsCssUrl, collectPageUsedFontIds } from "@/lib/page/fonts";
import type { PageBlock, PageSiteTheme } from "@/lib/page/types";

/**
 * サイトテーマ＋ブロックの上書き設定から使用中のGoogle Fontsを集約し、<link>を1本注入する。
 * 何も表示せず副作用のみ（PageRenderer内部から自動的に呼ばれる）。
 */
export function PageFontLoader({ theme, blocks = [] }: { theme: PageSiteTheme; blocks?: PageBlock[] }) {
  const href = useMemo(() => {
    const { jp, latin } = collectPageUsedFontIds(theme, blocks);
    return buildPageFontsCssUrl(jp, latin);
  }, [theme, blocks]);

  useEffect(() => {
    if (!href || typeof document === "undefined") return;
    const existing = document.querySelector(`link[data-page-font-href="${href}"]`);
    if (existing) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.pageFontHref = href;
    document.head.appendChild(link);
  }, [href]);

  return null;
}
