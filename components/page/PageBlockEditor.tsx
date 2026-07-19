"use client";

import type { ComponentType } from "react";
import {
  Building2,
  Code2,
  Columns2,
  Database,
  FormInput,
  GalleryHorizontal,
  GalleryThumbnails,
  Heading,
  ImageIcon,
  Link2,
  Minus,
  PanelTop,
  Plus,
  Trash2,
  Type
} from "lucide-react";
import { PageImageUploader } from "./PageImageUploader";
import { pageCmsSourceInfo, type PageCmsItem } from "@/lib/page/cms-selectors";
import type {
  PageAssetRef,
  PageBlock,
  PageBlockType,
  PageCmsSource,
  PageMediaItem
} from "@/lib/page/types";

const inputClass = "mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";

export const pageBlockChoices: { type: PageBlockType; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { type: "heading", label: "見出し", icon: Heading },
  { type: "text", label: "文章", icon: Type },
  { type: "image", label: "画像", icon: ImageIcon },
  { type: "button", label: "ボタン", icon: Link2 },
  { type: "columns", label: "カラム", icon: Columns2 },
  { type: "company", label: "会社概要", icon: Building2 },
  { type: "gallery", label: "画像グリッド", icon: GalleryThumbnails },
  { type: "slideshow", label: "スライド", icon: GalleryHorizontal },
  { type: "cms", label: "mikke CMS", icon: Database },
  { type: "embed", label: "外部埋め込み", icon: PanelTop },
  { type: "html", label: "HTML", icon: Code2 },
  { type: "form", label: "フォーム枠", icon: FormInput },
  { type: "divider", label: "区切り", icon: Minus }
];

export const pageCmsSourceLabels: Record<PageCmsSource, string> = {
  story: "Story",
  item_studio: "Item Studio",
  event: "Event",
  academy: "Academy",
  session: "Session",
  order: "Order",
  fund: "FUND",
  community: "Community"
};

export function createPageBuilderId(prefix = "page_block") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyPageBlock(type: PageBlockType, order: number): PageBlock {
  const base = { id: createPageBuilderId(), order, hidden: false, style: { spacing: "normal" as const, radius: "medium" as const, textAlign: "left" as const, animation: "none" as const } };
  if (type === "heading") return { ...base, type, level: 2, text: "新しい見出し" };
  if (type === "text") return { ...base, type, text: "ここに文章を入力します。", size: "normal" };
  if (type === "image") return { ...base, type, imageUrl: "", alt: "", caption: "", fit: "cover" };
  if (type === "button") return { ...base, type, label: "詳しく見る", href: "#", variant: "solid" };
  if (type === "form") return { ...base, type, title: "お問い合わせ", description: "必要事項をご入力ください。", buttonLabel: "送信する" };
  if (type === "cms") return { ...base, type, source: "story", displayMode: "cards", title: "最新の活動", filters: {} };
  if (type === "company") return { ...base, type, title: "会社概要", rows: ["会社・団体名", "代表者", "所在地", "設立", "事業内容"].map((label) => ({ id: createPageBuilderId("company_row"), label, value: "" })) };
  if (type === "columns") return { ...base, type, title: "2カラム", ratio: "1-1", columns: [1, 2].map((number) => ({ id: createPageBuilderId("column"), eyebrow: `COLUMN ${number}`, title: `カラム ${number}`, text: "文章を入力します。", imageUrl: "", imageAlt: "" })) };
  if (type === "gallery") return { ...base, type, title: "ギャラリー", columns: 3, images: [] };
  if (type === "slideshow") return { ...base, type, title: "スライドショー", images: [], autoplay: true, intervalSeconds: 5 };
  if (type === "embed") return { ...base, type, title: "", url: "", embedHtml: "", height: 480 };
  if (type === "html") return { ...base, type, title: "", html: "<section><h2>自由なHTMLブロック</h2><p>ここを編集してください。</p></section>", css: "body{margin:0;padding:24px;font-family:system-ui,sans-serif}h2{margin-top:0}", javascript: "", allowScripts: false, height: 360 };
  return { ...base, type: "divider" };
}

function currentImageUrl(asset: PageAssetRef | undefined, imageUrl: string) {
  return asset?.publicUrl || imageUrl;
}

function mediaFromAsset(asset: PageAssetRef): PageMediaItem {
  return { id: createPageBuilderId("media"), imageUrl: asset.publicUrl, asset, alt: asset.fileName, caption: "" };
}

export function PageBlockFields({ block, siteId, cmsContent, onChange }: {
  block: PageBlock;
  siteId: string;
  cmsContent: Record<PageCmsSource, PageCmsItem[]>;
  onChange: (next: PageBlock) => void;
}) {
  const update = <T extends PageBlock>(patch: Partial<T>) => onChange({ ...block, ...patch } as PageBlock);

  if (block.type === "heading") return <div className="grid gap-3 sm:grid-cols-[130px_1fr]"><Select label="大きさ" value={String(block.level)} onChange={(value) => update({ level: Number(value) as 1 | 2 | 3 })} options={[{ value: "1", label: "大" }, { value: "2", label: "中" }, { value: "3", label: "小" }]} /><TextInput label="見出し" value={block.text} onChange={(text) => update({ text })} /></div>;
  if (block.type === "text") return <div className="grid gap-3"><Select label="文字サイズ" value={block.size ?? "normal"} onChange={(size) => update({ size: size as "small" | "normal" | "large" })} options={[{ value: "small", label: "小さめ" }, { value: "normal", label: "標準" }, { value: "large", label: "大きめ" }]} /><TextArea label="文章" value={block.text} onChange={(text) => update({ text })} rows={6} /></div>;
  if (block.type === "image") return <div className="grid gap-3"><PageImageUploader siteId={siteId} currentUrl={currentImageUrl(block.asset, block.imageUrl)} onUploaded={(asset) => update({ asset, imageUrl: asset.publicUrl })} /><div className="grid gap-3 sm:grid-cols-2"><TextInput label="代替テキスト" value={block.alt} onChange={(alt) => update({ alt })} /><TextInput label="キャプション" value={block.caption ?? ""} onChange={(caption) => update({ caption })} /></div><Select label="表示方法" value={block.fit ?? "cover"} onChange={(fit) => update({ fit: fit as "cover" | "contain" })} options={[{ value: "cover", label: "枠いっぱい" }, { value: "contain", label: "全体を表示" }]} /></div>;
  if (block.type === "button") return <div className="grid gap-3 sm:grid-cols-2"><TextInput label="ラベル" value={block.label} onChange={(label) => update({ label })} /><TextInput label="リンク先" value={block.href} onChange={(href) => update({ href })} placeholder="https:// または #section" /><Select label="デザイン" value={block.variant ?? "solid"} onChange={(variant) => update({ variant: variant as "solid" | "outline" | "soft" })} options={[{ value: "solid", label: "塗り" }, { value: "outline", label: "枠線" }, { value: "soft", label: "淡い背景" }]} /></div>;
  if (block.type === "form") return <div className="grid gap-3"><TextInput label="タイトル" value={block.title} onChange={(title) => update({ title })} /><TextArea label="説明" value={block.description} onChange={(description) => update({ description })} rows={3} /><TextInput label="ボタン表示" value={block.buttonLabel} onChange={(buttonLabel) => update({ buttonLabel })} /><p className="text-xs text-[var(--mikke-muted)]">送信処理は公開・本接続フェーズで設計します。</p></div>;
  if (block.type === "divider") return <p className="text-xs text-[var(--mikke-muted)]">横線で内容を区切ります。</p>;
  if (block.type === "company") return <div className="grid gap-3"><TextInput label="見出し" value={block.title} onChange={(title) => update({ title })} />{block.rows.map((row, index) => <div key={row.id} className="grid grid-cols-[minmax(100px,.45fr)_1fr_36px] gap-2"><input aria-label={`${index + 1}行目の項目名`} value={row.label} onChange={(event) => update({ rows: block.rows.map((item) => item.id === row.id ? { ...item, label: event.target.value } : item) })} className={inputClass} /><input aria-label={`${index + 1}行目の内容`} value={row.value} onChange={(event) => update({ rows: block.rows.map((item) => item.id === row.id ? { ...item, value: event.target.value } : item) })} className={inputClass} /><button type="button" onClick={() => update({ rows: block.rows.filter((item) => item.id !== row.id) })} className="mt-1.5 grid h-10 place-items-center rounded-lg border border-[var(--mikke-line)] text-[var(--mikke-danger)]" aria-label="行を削除"><Trash2 size={14} /></button></div>)}<button type="button" onClick={() => update({ rows: [...block.rows, { id: createPageBuilderId("company_row"), label: "項目", value: "" }] })} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold"><Plus size={14} /> 行を追加</button></div>;
  if (block.type === "columns") return <div className="grid gap-4"><div className="grid gap-3 sm:grid-cols-2"><TextInput label="セクション見出し" value={block.title ?? ""} onChange={(title) => update({ title })} /><Select label="比率" value={block.ratio} onChange={(ratio) => { const nextRatio = ratio as typeof block.ratio; const count = nextRatio === "three" ? 3 : 2; const columns = [...block.columns]; while (columns.length < count) columns.push({ id: createPageBuilderId("column"), title: `カラム ${columns.length + 1}`, text: "文章を入力します。", imageUrl: "" }); update({ ratio: nextRatio, columns: columns.slice(0, count) }); }} options={[{ value: "1-1", label: "1 : 1" }, { value: "1-2", label: "1 : 2" }, { value: "2-1", label: "2 : 1" }, { value: "three", label: "3カラム" }]} /></div>{block.columns.map((column, index) => <section key={column.id} className="rounded-xl border border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] p-3"><p className="mb-3 text-xs font-bold text-[var(--mikke-accent)]">カラム {index + 1}</p><div className="grid gap-3"><PageImageUploader compact siteId={siteId} currentUrl={currentImageUrl(column.asset, column.imageUrl)} onUploaded={(asset) => update({ columns: block.columns.map((item) => item.id === column.id ? { ...item, asset, imageUrl: asset.publicUrl, imageAlt: item.imageAlt || asset.fileName } : item) })} /><TextInput label="小見出し" value={column.eyebrow ?? ""} onChange={(eyebrow) => update({ columns: block.columns.map((item) => item.id === column.id ? { ...item, eyebrow } : item) })} /><TextInput label="見出し" value={column.title} onChange={(title) => update({ columns: block.columns.map((item) => item.id === column.id ? { ...item, title } : item) })} /><TextArea label="文章" value={column.text} onChange={(text) => update({ columns: block.columns.map((item) => item.id === column.id ? { ...item, text } : item) })} rows={3} /><div className="grid gap-3 sm:grid-cols-2"><TextInput label="ボタン" value={column.buttonLabel ?? ""} onChange={(buttonLabel) => update({ columns: block.columns.map((item) => item.id === column.id ? { ...item, buttonLabel } : item) })} /><TextInput label="リンク先" value={column.href ?? ""} onChange={(href) => update({ columns: block.columns.map((item) => item.id === column.id ? { ...item, href } : item) })} /></div></div></section>)}</div>;
  if (block.type === "gallery" || block.type === "slideshow") {
    const images = block.images;
    return <div className="grid gap-3"><TextInput label="見出し" value={block.title} onChange={(title) => update({ title })} />{block.type === "gallery" ? <Select label="列数" value={String(block.columns)} onChange={(columns) => update({ columns: Number(columns) as 2 | 3 | 4 })} options={[{ value: "2", label: "2列" }, { value: "3", label: "3列" }, { value: "4", label: "4列" }]} /> : <div className="flex flex-wrap gap-3"><Check label="自動再生" checked={block.autoplay} onChange={(autoplay) => update({ autoplay })} /><Select label="切り替え" value={String(block.intervalSeconds)} onChange={(seconds) => update({ intervalSeconds: Number(seconds) as 3 | 5 | 8 })} options={[{ value: "3", label: "3秒" }, { value: "5", label: "5秒" }, { value: "8", label: "8秒" }]} /></div>}<PageImageUploader siteId={siteId} onUploaded={(asset) => update({ images: [...images, mediaFromAsset(asset)] })} />{images.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{images.map((item, index) => <div key={item.id} className="relative overflow-hidden rounded-lg border border-[var(--mikke-line)] bg-white"><img src={currentImageUrl(item.asset, item.imageUrl)} alt={item.alt} className="aspect-square w-full object-cover" /><button type="button" onClick={() => update({ images: images.filter((image) => image.id !== item.id) })} aria-label={`${index + 1}枚目を削除`} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[var(--mikke-danger)]"><Trash2 size={13} /></button></div>)}</div> : null}</div>;
  }
  if (block.type === "embed") return <div className="grid gap-3"><TextInput label="見出し（任意）" value={block.title ?? ""} onChange={(title) => update({ title })} /><TextInput label="埋め込みURL" value={block.url} onChange={(url) => update({ url })} placeholder="Instagram、YouTube、Googleマップ、ガジェットURL" /><NumberInput label="高さ（px）" value={block.height} min={180} max={1200} onChange={(height) => update({ height })} /><p className="text-xs leading-5 text-[var(--mikke-muted)]">外部コンテンツはPage本体から隔離して表示します。提供元の仕様により表示できないURLがあります。</p></div>;
  if (block.type === "html") return <div className="grid gap-3"><TextInput label="見出し（任意）" value={block.title ?? ""} onChange={(title) => update({ title })} /><CodeArea label="HTML" value={block.html} onChange={(html) => update({ html })} rows={7} /><CodeArea label="CSS" value={block.css} onChange={(css) => update({ css })} rows={6} /><Check label="JavaScriptを有効にする" checked={block.allowScripts} onChange={(allowScripts) => update({ allowScripts })} />{block.allowScripts ? <CodeArea label="JavaScript" value={block.javascript} onChange={(javascript) => update({ javascript })} rows={5} /> : null}<NumberInput label="高さ（px）" value={block.height} min={180} max={1200} onChange={(height) => update({ height })} /><p className="text-xs leading-5 text-[var(--mikke-muted)]">HTMLは安全な独立領域で表示され、mikkeOSのログイン情報や親画面にはアクセスできません。</p></div>;
  if (block.type === "cms") {
    const candidates = cmsContent[block.source];
    const selected = block.filters.selectedItemIds ?? [];
    const info = pageCmsSourceInfo[block.source];
    return <div className="grid gap-3"><TextInput label="見出し" value={block.title} onChange={(title) => update({ title })} /><div className="grid gap-3 sm:grid-cols-2"><Select label="参照元" value={block.source} onChange={(source) => update({ source: source as PageCmsSource, filters: { ...block.filters, selectedItemIds: [] } })} options={Object.entries(pageCmsSourceLabels).map(([value, label]) => ({ value, label }))} /><Select label="表示" value={block.displayMode} onChange={(displayMode) => update({ displayMode: displayMode as "list" | "cards" | "featured" })} options={[{ value: "list", label: "リスト" }, { value: "cards", label: "カード" }, { value: "featured", label: "注目表示" }]} /></div><dl className="grid gap-2 rounded-xl border border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] p-3 text-xs leading-5 sm:grid-cols-3"><div><dt className="font-bold text-[var(--mikke-accent)]">mikkeID接続</dt><dd className="mt-1 text-[var(--mikke-muted)]">{info.connection}</dd></div><div><dt className="font-bold text-[var(--mikke-accent)]">表示できる内容</dt><dd className="mt-1 text-[var(--mikke-muted)]">{info.visibleFields}</dd></div><div><dt className="font-bold text-[var(--mikke-accent)]">表示条件</dt><dd className="mt-1 text-[var(--mikke-muted)]">{info.visibilityRule}</dd></div></dl><div className="flex flex-wrap gap-2"><Check label="今月のみ" checked={block.filters.thisMonthOnly ?? false} onChange={(thisMonthOnly) => update({ filters: { ...block.filters, thisMonthOnly } })} /><Check label="承認済みのみ" checked={block.filters.approvedOnly ?? false} onChange={(approvedOnly) => update({ filters: { ...block.filters, approvedOnly } })} /></div><fieldset className="rounded-xl border border-[var(--mikke-line-soft)] p-3"><legend className="px-1 text-xs font-bold">表示する項目（未選択ならすべて）</legend>{candidates.length ? <div className="grid gap-2 sm:grid-cols-2">{candidates.map((item) => <label key={item.id} className="flex items-start gap-2 rounded-lg bg-[var(--mikke-surface-soft)] p-2 text-xs"><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => update({ filters: { ...block.filters, selectedItemIds: event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id) } })} /><span><strong className="block">{item.title}</strong><span className="text-[var(--mikke-muted)]">{item.meta}</span></span></label>)}</div> : <p className="text-xs text-[var(--mikke-muted)]">現在選択できる公開候補はありません。</p>}</fieldset><p className="text-xs leading-5 text-[var(--mikke-muted)]">Pageには選択IDと絞り込み条件だけを保存し、元アプリのデータはコピーしません。</p></div>;
  }
  return null;
}

export function PageBlockStyleFields({ block, onChange }: { block: PageBlock; onChange: (next: PageBlock) => void }) {
  const style = block.style ?? {};
  return <div className="grid gap-3 border-t border-[var(--mikke-line-soft)] pt-4"><p className="text-xs font-bold">デザインと動き</p><div className="grid gap-3 sm:grid-cols-2"><Select label="文字位置" value={style.textAlign ?? "left"} onChange={(textAlign) => onChange({ ...block, style: { ...style, textAlign: textAlign as "left" | "center" | "right" } })} options={[{ value: "left", label: "左" }, { value: "center", label: "中央" }, { value: "right", label: "右" }]} /><Select label="余白" value={style.spacing ?? "normal"} onChange={(spacing) => onChange({ ...block, style: { ...style, spacing: spacing as "compact" | "normal" | "spacious" } })} options={[{ value: "compact", label: "コンパクト" }, { value: "normal", label: "標準" }, { value: "spacious", label: "ゆったり" }]} /><Select label="角丸" value={style.radius ?? "medium"} onChange={(radius) => onChange({ ...block, style: { ...style, radius: radius as "none" | "medium" | "large" } })} options={[{ value: "none", label: "なし" }, { value: "medium", label: "標準" }, { value: "large", label: "大きめ" }]} /><Select label="アニメーション" value={style.animation ?? "none"} onChange={(animation) => onChange({ ...block, style: { ...style, animation: animation as NonNullable<typeof style.animation> } })} options={[{ value: "none", label: "なし" }, { value: "fade", label: "フェード" }, { value: "fade-up", label: "下から表示" }, { value: "zoom", label: "ふわっと拡大" }, { value: "slide-left", label: "右から" }, { value: "slide-right", label: "左から" }]} /><ColorInput label="背景色" value={style.backgroundColor ?? "#ffffff"} onChange={(backgroundColor) => onChange({ ...block, style: { ...style, backgroundColor } })} /><ColorInput label="文字色" value={style.textColor ?? "#17203a"} onChange={(textColor) => onChange({ ...block, style: { ...style, textColor } })} /></div></div>;
}

function TextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="block"><span className="text-xs font-bold">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} placeholder={placeholder} /></label>; }
function TextArea({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) { return <label className="block"><span className="text-xs font-bold">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className={`${inputClass} resize-y`} /></label>; }
function CodeArea({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) { return <label className="block"><span className="text-xs font-bold">{label}</span><textarea spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className={`${inputClass} resize-y font-mono text-xs leading-5`} /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label className="block"><span className="text-xs font-bold">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function NumberInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) { return <label className="block"><span className="text-xs font-bold">{label}</span><input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} className={inputClass} /></label>; }
function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="text-xs font-bold">{label}</span><div className="mt-1.5 flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] bg-white p-2"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-8 w-10 cursor-pointer border-0 bg-transparent" /><input value={value} onChange={(event) => /^#[0-9a-fA-F]{0,6}$/.test(event.target.value) && onChange(event.target.value)} className="min-w-0 flex-1 text-xs outline-none" /></div></label>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>; }
