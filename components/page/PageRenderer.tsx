"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import type { PageCmsItem } from "@/lib/page/cms-selectors";
import { buildSandboxedHtmlDocument, normalizePageEmbedUrl } from "@/lib/page/html";
import type {
  PageBlock,
  PageCmsBlock,
  PageCmsSource,
  PageDocument,
  PageMediaItem,
  PageSiteTheme
} from "@/lib/page/types";
import styles from "./PageRenderer.module.css";

const sourceLabels: Record<PageCmsSource, string> = {
  story: "Story",
  item_studio: "Item Studio",
  event: "Event",
  academy: "Academy",
  session: "Session",
  order: "Order",
  fund: "FUND",
  community: "Community"
};

const widthClass = { narrow: "max-w-3xl", standard: "max-w-5xl", wide: "max-w-7xl" } as const;

function animationClass(block: PageBlock) {
  const animation = block.style?.animation ?? "none";
  if (animation === "fade") return styles.fade;
  if (animation === "fade-up") return styles.fadeUp;
  if (animation === "zoom") return styles.zoom;
  if (animation === "slide-left") return styles.slideLeft;
  if (animation === "slide-right") return styles.slideRight;
  return "";
}

function blockShellStyle(block: PageBlock): CSSProperties {
  const spacing = block.style?.spacing ?? "normal";
  const radius = block.style?.radius ?? "medium";
  return {
    backgroundColor: block.style?.backgroundColor || "transparent",
    color: block.style?.textColor || "inherit",
    textAlign: block.style?.textAlign ?? "left",
    padding: spacing === "compact" ? "12px" : spacing === "spacious" ? "36px" : "22px",
    borderRadius: radius === "none" ? 0 : radius === "large" ? "28px" : "16px"
  };
}

function imageSource(item: Pick<PageMediaItem, "asset" | "imageUrl">) {
  return item.asset?.publicUrl || item.imageUrl;
}

export function PageRenderer({ document, theme, cmsContent, compact = false }: {
  document: Pick<PageDocument, "mode" | "blocks" | "htmlDocument">;
  theme: PageSiteTheme;
  cmsContent: Record<PageCmsSource, PageCmsItem[]>;
  compact?: boolean;
}) {
  if (document.mode === "html") {
    const srcDoc = buildSandboxedHtmlDocument(document.htmlDocument);
    return <iframe title="AI HTMLページ" srcDoc={srcDoc} sandbox={document.htmlDocument.allowScripts ? "allow-scripts allow-forms allow-popups" : ""} className="h-[720px] w-full border-0 bg-white" />;
  }

  const themeStyle = {
    backgroundColor: theme.backgroundColor,
    color: theme.textColor,
    fontFamily: theme.bodyFont,
    "--page-primary": theme.primaryColor,
    "--page-accent": theme.accentColor,
    "--page-heading-font": theme.headingFont
  } as CSSProperties;

  return (
    <div style={themeStyle} className={compact ? "min-h-72" : "min-h-screen"}>
      <div className={`mx-auto space-y-5 ${widthClass[theme.contentWidth]} ${compact ? "p-4" : "px-4 py-10 sm:px-8 sm:py-14"}`}>
        {document.blocks.filter((block) => !block.hidden).length === 0 ? (
          <p className="py-20 text-center text-sm opacity-60">テンプレートまたはブロックを追加してください。</p>
        ) : document.blocks.filter((block) => !block.hidden).map((block) => (
          <div key={block.id} className={animationClass(block)} style={blockShellStyle(block)}>
            <RenderedBlock block={block} cmsContent={cmsContent} theme={theme} compact={compact} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RenderedBlock({ block, cmsContent, theme, compact }: { block: PageBlock; cmsContent: Record<PageCmsSource, PageCmsItem[]>; theme: PageSiteTheme; compact: boolean }) {
  if (block.type === "heading") {
    const size = block.level === 1 ? (compact ? "text-3xl" : "text-4xl sm:text-6xl") : block.level === 2 ? (compact ? "text-2xl" : "text-3xl sm:text-4xl") : "text-xl sm:text-2xl";
    return <h2 className={`${size} font-extrabold leading-tight tracking-tight`} style={{ fontFamily: "var(--page-heading-font)" }}>{block.text || "見出し"}</h2>;
  }
  if (block.type === "text") {
    const size = block.size === "small" ? "text-sm" : block.size === "large" ? "text-lg sm:text-xl" : "text-base";
    return <p className={`whitespace-pre-wrap ${size} leading-8 opacity-90`}>{block.text}</p>;
  }
  if (block.type === "image") {
    const src = block.asset?.publicUrl || block.imageUrl;
    return src ? <figure><img src={src} alt={block.alt} loading="lazy" className={`max-h-[680px] w-full rounded-2xl ${block.fit === "contain" ? "object-contain" : "object-cover"}`} />{block.caption ? <figcaption className="mt-2 text-center text-xs opacity-60">{block.caption}</figcaption> : null}</figure> : <ImagePlaceholder />;
  }
  if (block.type === "button") {
    const radius = theme.buttonStyle === "pill" ? "rounded-full" : theme.buttonStyle === "square" ? "rounded-none" : "rounded-xl";
    const variant = block.variant ?? "solid";
    const style = variant === "solid" ? { backgroundColor: "var(--page-primary)", color: "white" } : variant === "outline" ? { borderColor: "var(--page-primary)", color: "var(--page-primary)" } : { backgroundColor: "color-mix(in srgb, var(--page-primary) 12%, white)", color: "var(--page-primary)" };
    return <a href={block.href || "#"} className={`inline-flex border px-5 py-3 text-sm font-bold ${radius}`} style={style}>{block.label || "ボタン"}</a>;
  }
  if (block.type === "form") return <section className="mx-auto max-w-xl rounded-2xl border border-black/10 bg-white/80 p-5 text-left"><h3 className="text-lg font-bold">{block.title}</h3><p className="mt-2 text-sm leading-6 opacity-70">{block.description}</p><div className="mt-4 h-11 rounded-xl border border-black/10 bg-white" /><button type="button" disabled className="mt-3 rounded-xl px-5 py-3 text-sm font-bold text-white opacity-60" style={{ backgroundColor: "var(--page-primary)" }}>{block.buttonLabel}</button></section>;
  if (block.type === "divider") return <hr className="border-black/10" />;
  if (block.type === "company") return <section><h2 className="mb-5 text-2xl font-bold" style={{ fontFamily: "var(--page-heading-font)" }}>{block.title}</h2><dl className="divide-y divide-black/10 border-y border-black/10">{block.rows.map((row) => <div key={row.id} className="grid gap-1 py-4 sm:grid-cols-[160px_1fr]"><dt className="text-sm font-bold opacity-60">{row.label}</dt><dd className="whitespace-pre-wrap text-sm leading-7">{row.value || "—"}</dd></div>)}</dl></section>;
  if (block.type === "columns") {
    const grid = block.ratio === "three" ? "md:grid-cols-3" : block.ratio === "1-2" ? "md:grid-cols-[1fr_2fr]" : block.ratio === "2-1" ? "md:grid-cols-[2fr_1fr]" : "md:grid-cols-2";
    return <section>{block.title ? <h2 className="mb-6 text-2xl font-bold" style={{ fontFamily: "var(--page-heading-font)" }}>{block.title}</h2> : null}<div className={`grid gap-5 ${grid}`}>{block.columns.map((column) => <article key={column.id} className="overflow-hidden rounded-2xl border border-black/10 bg-white/70">{column.asset?.publicUrl || column.imageUrl ? <img src={column.asset?.publicUrl || column.imageUrl} alt={column.imageAlt || ""} loading="lazy" className="h-52 w-full object-cover" /> : null}<div className="p-5">{column.eyebrow ? <p className="text-xs font-bold tracking-[.15em]" style={{ color: "var(--page-accent)" }}>{column.eyebrow}</p> : null}<h3 className="mt-1 text-xl font-bold" style={{ fontFamily: "var(--page-heading-font)" }}>{column.title}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 opacity-75">{column.text}</p>{column.buttonLabel ? <a href={column.href || "#"} className="mt-4 inline-flex text-sm font-bold" style={{ color: "var(--page-primary)" }}>{column.buttonLabel} →</a> : null}</div></article>)}</div></section>;
  }
  if (block.type === "gallery") return <section><h2 className="mb-5 text-2xl font-bold" style={{ fontFamily: "var(--page-heading-font)" }}>{block.title}</h2>{block.images.length ? <div className={`grid gap-3 ${block.columns === 2 ? "grid-cols-2" : block.columns === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 md:grid-cols-3"}`}>{block.images.map((item) => <figure key={item.id}><img src={imageSource(item)} alt={item.alt} loading="lazy" className="aspect-square w-full rounded-xl object-cover" />{item.caption ? <figcaption className="mt-1 text-xs opacity-60">{item.caption}</figcaption> : null}</figure>)}</div> : <ImagePlaceholder label="画像を追加するとグリッド表示されます" />}</section>;
  if (block.type === "slideshow") return <Slideshow block={block} />;
  if (block.type === "embed") {
    const url = normalizePageEmbedUrl(block.url);
    return <section>{block.title ? <h2 className="mb-4 text-xl font-bold">{block.title}</h2> : null}{url ? <iframe title={block.title || "外部コンテンツ"} src={url} loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation" referrerPolicy="strict-origin-when-cross-origin" style={{ height: Math.max(180, Math.min(1200, block.height)) }} className="w-full rounded-2xl border border-black/10 bg-white" /> : <p className="rounded-xl bg-black/5 p-5 text-sm opacity-60">https://から始まる埋め込みURLを入力してください。</p>}</section>;
  }
  if (block.type === "html") {
    const srcDoc = buildSandboxedHtmlDocument(block);
    return <section>{block.title ? <h2 className="mb-4 text-xl font-bold">{block.title}</h2> : null}<iframe title={block.title || "HTMLブロック"} srcDoc={srcDoc} sandbox={block.allowScripts ? "allow-scripts allow-forms allow-popups" : ""} style={{ height: Math.max(180, Math.min(1200, block.height)) }} className="w-full rounded-2xl border border-black/10 bg-white" /></section>;
  }
  return <CmsBlock block={block} items={cmsContent[block.source]} />;
}

function CmsBlock({ block, items }: { block: PageCmsBlock; items: PageCmsItem[] }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const selected = block.filters.selectedItemIds ?? [];
  const filtered = useMemo(() => items.filter((item) => {
    if (selected.length && !selected.includes(item.id)) return false;
    if (block.filters.thisMonthOnly && !item.occurredAt.startsWith(currentMonth)) return false;
    if (block.filters.approvedOnly && !item.approved) return false;
    return true;
  }), [block.filters.approvedOnly, block.filters.thisMonthOnly, currentMonth, items, selected]);
  const visible = block.displayMode === "featured" ? filtered.slice(0, 1) : filtered.slice(0, 8);
  return <section><div className="flex items-end justify-between gap-3"><h2 className="text-2xl font-bold" style={{ fontFamily: "var(--page-heading-font)" }}>{block.title || sourceLabels[block.source]}</h2><span className="text-xs font-bold opacity-50">{sourceLabels[block.source]}</span></div>{visible.length === 0 ? <p className="mt-4 rounded-xl bg-black/5 p-5 text-sm opacity-60">公開中の表示候補はありません。</p> : <div className={block.displayMode === "list" ? "mt-4 space-y-3" : "mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>{visible.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-black/10 bg-white/80">{item.imageUrl && block.displayMode !== "list" ? <img src={item.imageUrl} alt="" loading="lazy" className="h-40 w-full object-cover" /> : null}<div className="p-4"><h3 className="font-bold">{item.title}</h3>{item.summary ? <p className="mt-2 line-clamp-3 text-sm leading-6 opacity-65">{item.summary}</p> : null}{item.meta ? <p className="mt-3 text-xs font-bold" style={{ color: "var(--page-accent)" }}>{item.meta}</p> : null}{item.href ? <a href={item.href} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-bold" style={{ color: "var(--page-primary)" }}>詳しく見る →</a> : null}</div></article>)}</div>}</section>;
}

function Slideshow({ block }: { block: Extract<PageBlock, { type: "slideshow" }> }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!block.autoplay || block.images.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % block.images.length), block.intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [block.autoplay, block.images.length, block.intervalSeconds]);
  useEffect(() => { if (index >= block.images.length) setIndex(0); }, [block.images.length, index]);
  if (!block.images.length) return <section><h2 className="mb-5 text-2xl font-bold">{block.title}</h2><ImagePlaceholder label="画像を追加するとスライド表示されます" /></section>;
  const current = block.images[index];
  return <section><h2 className="mb-5 text-2xl font-bold">{block.title}</h2><div className="relative overflow-hidden rounded-2xl"><img src={imageSource(current)} alt={current.alt} className="aspect-[16/8] w-full object-cover" />{current.caption ? <p className="absolute inset-x-0 bottom-0 bg-black/55 p-4 text-sm text-white">{current.caption}</p> : null}{block.images.length > 1 ? <><button type="button" onClick={() => setIndex((index - 1 + block.images.length) % block.images.length)} aria-label="前の画像" className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-black"><ChevronLeft size={18} /></button><button type="button" onClick={() => setIndex((index + 1) % block.images.length)} aria-label="次の画像" className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-black"><ChevronRight size={18} /></button></> : null}</div><div className="mt-3 flex justify-center gap-1.5">{block.images.map((item, itemIndex) => <button key={item.id} type="button" onClick={() => setIndex(itemIndex)} aria-label={`${itemIndex + 1}枚目`} className={`h-2 rounded-full ${itemIndex === index ? "w-6" : "w-2"}`} style={{ backgroundColor: itemIndex === index ? "var(--page-primary)" : "rgba(0,0,0,.18)" }} />)}</div></section>;
}

function ImagePlaceholder({ label = "画像ファイルを追加してください" }: { label?: string }) {
  return <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-black/15 bg-black/[.03] p-6 text-center text-sm opacity-55"><div><ImageIcon className="mx-auto mb-2" />{label}</div></div>;
}
