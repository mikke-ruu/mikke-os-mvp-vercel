"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { pageJpFonts, pageJpFontOrder, buildPageFontsCssUrl, buildPageFontFamily } from "@/lib/page/fonts";
import { bounded, lpFonts, lpBackground, safeLpColor, type LpBlock, type LpStyle } from "./lp-design";
import styles from "./lp-design.module.css";

export function LpDesignFields({ block, onChange, imagePicker, expanded = false }: { block: LpBlock; onChange: (b: LpBlock) => void; imagePicker?: ReactNode; expanded?: boolean }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const values = block.lp?.[device] ?? {};
  const patch = (delta: Partial<LpStyle>) => onChange({ ...block, lp: { ...block.lp, [device]: { ...values, ...delta } } });
  const numbers = [["size", "文字サイズ", 12, 80, 1], ["lineHeight", "行間", 1, 2.5, 0.1], ["letterSpacing", "字間", 0, 8, 0.5], ["padding", "内側の余白", 0, 80, 4], ["gap", "部品の間隔", 0, 64, 4], ["radius", "角丸", 0, 48, 2]] as const;
  return <details className={styles.settings} open={expanded || undefined}><summary>デザイン</summary>
    <div className={styles.devices}>{(["desktop", "mobile"] as const).map(d => <button type="button" key={d} aria-pressed={device === d} onClick={() => setDevice(d)}>{d === "desktop" ? "基本" : "スマホ"}</button>)}</div>
    {device === "mobile" && <small>空欄は基本設定を使います。</small>}
    <label>フォント<select value={values.font ?? ""} onChange={e => patch({ font: (e.target.value || undefined) as LpStyle["font"] })}><option value="">引き継ぐ</option>{pageJpFontOrder.map(id => <option key={id} value={id}>{pageJpFonts[id].helper}</option>)}</select></label>
    <div className={styles.fields}>{numbers.map(([key, label, min, max, step]) => <label key={key}>{label}<input type="number" aria-label={`${device === "mobile" ? "スマホの" : ""}${label}`} min={min} max={max} step={step} placeholder="自動" value={values[key] ?? ""} onChange={e => patch({ [key]: e.target.value === "" ? undefined : bounded(Number(e.target.value), min, max) })} /></label>)}</div>
    <div className={styles.fields}>{([["color", "文字色"], ["background", "背景色"], ["border", "枠線色"]] as const).map(([key, label]) => <label key={key}>{label}<input type="color" aria-label={label} value={values[key] ?? "#ffffff"} onChange={e => patch({ [key]: e.target.value })}/><button type="button" onClick={() => patch({ [key]: undefined })}>解除</button></label>)}</div>
    {block.lp?.children && <label>段組み<select value={values.columns ?? ""} onChange={e => patch({ columns: (e.target.value ? Number(e.target.value) : undefined) as LpStyle["columns"] })}><option value="">自動</option>{[1, 2, 3].map(n => <option key={n} value={n}>{n}列</option>)}</select></label>}
    <label>影<select value={values.shadow === undefined ? "" : String(values.shadow)} onChange={e => patch({ shadow: e.target.value === "" ? undefined : e.target.value === "true" })}><option value="">引き継ぐ</option><option value="true">あり</option><option value="false">なし</option></select></label>
    <label>表示の動き<select value={block.lp?.motion ?? "none"} onChange={e => onChange({ ...block, lp: { ...block.lp, motion: e.target.value as "none" | "fade" | "rise" } })}><option value="none">なし</option><option value="fade">フェード</option><option value="rise">下から表示</option></select></label>
    <details><summary>背景画像</summary>{imagePicker}<button type="button" onClick={() => onChange({ ...block, lp: { ...block.lp, backgroundImage: undefined } })}>背景画像を外す</button></details>
    <button type="button" onClick={() => onChange({ ...block, lp: { ...block.lp, [device]: undefined } })}>この端末の設定をリセット</button>
  </details>;
}

function variables(s: LpStyle, prefix: string): CSSProperties {
  const out: Record<string, string | number> = {};
  const put = (key: string, value: string | number | undefined) => { if (value !== undefined) out[`--lp-${prefix}${key}`] = value; };
  for (const key of ["color", "background", "border"] as const) put(key, safeLpColor(s[key]));
  for (const [key, max] of [["size", 80], ["padding", 80], ["gap", 64], ["radius", 48], ["letterSpacing", 8]] as const) {
    const n = bounded(s[key], key === "size" ? 12 : 0, max); put(key, n === undefined ? undefined : `${n}px`);
  }
  put("lineHeight", bounded(s.lineHeight, 1, 2.5)); put("columns", bounded(s.columns, 1, 3));
  if (s.font && pageJpFonts[s.font]) put("font", buildPageFontFamily(s.font, undefined, "sans-serif"));
  if (s.shadow !== undefined) put("shadow", s.shadow ? "0 6px 24px #00000014" : "none");
  return out as CSSProperties;
}

function Slides({ block }: { block: LpBlock }) {
  const items = (block.images ?? []).filter(i => i.url);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [reduced, setReduced] = useState(true);
  const start = useRef<number | null>(null);
  useEffect(() => { const mq = matchMedia("(prefers-reduced-motion: reduce)"); const update = () => setReduced(mq.matches); update(); mq.addEventListener("change", update); return () => mq.removeEventListener("change", update); }, []);
  useEffect(() => { if (!block.lp?.autoplay || paused || hover || reduced || items.length < 2) return; const timer = setInterval(() => setIndex(i => (i + 1) % items.length), 5000); return () => clearInterval(timer); }, [block.lp?.autoplay, paused, hover, reduced, items.length]);
  const current = index % Math.max(1, items.length), item = items[current];
  const step = (n: number) => { setPaused(true); setIndex((current + n + items.length) % items.length); };
  if (!item) return <p>画像を追加してください。</p>;
  return <div className={styles.slides} role="region" aria-label="画像スライド" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setPaused(true)} onTouchStart={e => { start.current = e.touches[0].clientX; }} onTouchEnd={e => { if (start.current !== null && Math.abs(e.changedTouches[0].clientX - start.current) > 40) step(e.changedTouches[0].clientX < start.current ? 1 : -1); start.current = null; }}>
    <figure>{item.href && /^https:\/\//i.test(item.href) ? <a href={item.href} target="_blank" rel="noopener noreferrer"><img src={item.url} alt={item.alt}/></a> : <img src={item.url} alt={item.alt}/>}{item.caption && <figcaption>{item.caption}</figcaption>}</figure>
    {items.length > 1 && <div className={styles.controls}><button type="button" aria-label="前の画像" onClick={() => step(-1)}>←</button><div className={styles.dots} role="group" aria-label="表示する画像">{items.map((_, i) => <button key={i} type="button" aria-label={`${i + 1}枚目を表示`} aria-pressed={current === i} onClick={() => { setPaused(true); setIndex(i); }}><span aria-hidden="true">●</span></button>)}</div><button type="button" aria-label="次の画像" onClick={() => step(1)}>→</button></div>}
  </div>;
}

export function LpContent({ blocks, render, nested = false, decorate }: { blocks: LpBlock[]; render: (blocks: LpBlock[]) => ReactNode; nested?: boolean; decorate?: (block: LpBlock, content: ReactNode) => ReactNode }) {
  if (!decorate && !blocks.some(b => b.lp)) return <>{render(blocks)}</>;
  const fontUrl = buildPageFontsCssUrl(lpFonts(blocks), []);
  return <div className={styles.content} data-lp-root={!nested || undefined}>{!nested && fontUrl && <link rel="stylesheet" href={fontUrl}/>}{blocks.map(block => {
    const content = !block.lp ? render([block]) : <section className={styles.styled} data-size={block.lp.desktop?.size !== undefined || block.lp.mobile?.size !== undefined || undefined} data-motion={block.lp.motion} style={{ ...variables(block.lp.desktop ?? {}, ""), ...variables(block.lp.mobile ?? {}, "m-"), ...(lpBackground(block.lp.backgroundImage) ? { backgroundImage: lpBackground(block.lp.backgroundImage), backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
      {block.lp.children ? <div className={styles.grid}>{block.lp.children.map(child => <LpContent nested key={child.id} blocks={[child]} render={render} decorate={decorate}/>)}</div> : block.lp.slideshow && block.type === "gallery" ? <Slides block={block}/> : render([block])}
    </section>;
    return <div key={block.id}>{decorate ? decorate(block, content) : content}</div>;
  })}</div>;
}
