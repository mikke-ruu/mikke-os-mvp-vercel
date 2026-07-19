"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Laptop,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Undo2
} from "lucide-react";
import { useParams } from "next/navigation";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import {
  PageBlockFields,
  PageBlockStyleFields,
  createEmptyPageBlock,
  createPageBuilderId,
  pageBlockChoices
} from "./PageBlockEditor";
import { PageRenderer } from "./PageRenderer";
import { usePageCmsContent } from "@/lib/page/cms-selectors";
import {
  createSectionTemplate,
  createStarterTemplate,
  defaultPageHtmlDocument,
  pageThemePresets,
  type PageSectionTemplateId,
  type PageStarterTemplateId
} from "@/lib/page/templates";
import {
  getPageDocument,
  getPageSite,
  normalizePageSiteSlug,
  savePageDocument,
  savePageSiteTheme
} from "@/lib/page/store";
import type {
  PageBlock,
  PageDocument,
  PageDocumentMode,
  PageHtmlDocument,
  PageSite,
  PageSiteTheme
} from "@/lib/page/types";

const inputClass = "mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";
const starterTemplates: { id: PageStarterTemplateId; label: string; helper: string }[] = [
  { id: "company", label: "会社・団体", helper: "ホーム、紹介、会社概要、CTA" },
  { id: "service", label: "サービス", helper: "特徴、CMS、問い合わせ導線" },
  { id: "portfolio", label: "作品・実績", helper: "ギャラリーと活動CMS" },
  { id: "connect-partners", label: "Connect / Partners", helper: "複数アプリCMSの構築例" },
  { id: "blank", label: "白紙", helper: "すべて自分で組み立てる" }
];
const sectionTemplates: { id: PageSectionTemplateId; label: string }[] = [
  { id: "hero", label: "メインビジュアル" },
  { id: "image-text", label: "画像＋文章" },
  { id: "company", label: "会社概要" },
  { id: "features", label: "特徴カード" },
  { id: "cta", label: "お問い合わせ導線" },
  { id: "cms", label: "CMS一覧" }
];

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function renewNestedIds(block: PageBlock): PageBlock {
  const next = { ...deepClone(block), id: createPageBuilderId() } as PageBlock;
  if (next.type === "company") next.rows = next.rows.map((row) => ({ ...row, id: createPageBuilderId("company_row") }));
  if (next.type === "columns") next.columns = next.columns.map((column) => ({ ...column, id: createPageBuilderId("column") }));
  if (next.type === "gallery" || next.type === "slideshow") next.images = next.images.map((image) => ({ ...image, id: createPageBuilderId("media") }));
  return next;
}

export function PageDocumentEditor() {
  const params = useParams<{ siteId: string; pageId: string }>();
  const [site, setSite] = useState<PageSite | null>(null);
  const [document, setDocument] = useState<PageDocument | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [mode, setMode] = useState<PageDocumentMode>("builder");
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [htmlDocument, setHtmlDocument] = useState<PageHtmlDocument>({ ...defaultPageHtmlDocument });
  const [theme, setTheme] = useState<PageSiteTheme>(pageThemePresets.gothic);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [past, setPast] = useState<PageBlock[][]>([]);
  const [future, setFuture] = useState<PageBlock[][]>([]);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const cmsContent = usePageCmsContent(site?.ownerProfileId);

  useEffect(() => {
    const nextSite = getPageSite(params.siteId);
    const nextDocument = getPageDocument(params.siteId, params.pageId);
    setSite(nextSite);
    setDocument(nextDocument);
    setTitle(nextDocument?.title ?? "");
    setSlug(nextDocument?.slug ?? "");
    setMode(nextDocument?.mode ?? "builder");
    setBlocks(nextDocument?.blocks.slice().sort((a, b) => a.order - b.order) ?? []);
    setHtmlDocument(nextDocument?.htmlDocument ?? { ...defaultPageHtmlDocument });
    setTheme(nextSite?.theme ?? pageThemePresets.gothic);
    setPast([]);
    setFuture([]);
    setDirty(false);
    setLoaded(true);
  }, [params.pageId, params.siteId]);

  const previewDocument = useMemo(() => ({ mode, blocks, htmlDocument }), [blocks, htmlDocument, mode]);

  function commitBlocks(next: PageBlock[]) {
    setPast((current) => [...current, deepClone(blocks)].slice(-50));
    setFuture([]);
    setBlocks(next.map((block, index) => ({ ...block, order: index + 1 })));
    setDirty(true);
  }

  function updateBlock(blockId: string, next: PageBlock) {
    commitBlocks(blocks.map((block) => block.id === blockId ? next : block));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    commitBlocks(next);
  }

  function undo() {
    const previous = past[past.length - 1];
    if (!previous) return;
    setFuture((current) => [deepClone(blocks), ...current].slice(0, 50));
    setPast((current) => current.slice(0, -1));
    setBlocks(previous);
    setDirty(true);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setPast((current) => [...current, deepClone(blocks)].slice(-50));
    setFuture((current) => current.slice(1));
    setBlocks(next);
    setDirty(true);
  }

  function addBlocks(nextBlocks: PageBlock[]) {
    const start = blocks.length;
    const prepared = nextBlocks.map((block, index) => ({ ...renewNestedIds(block), order: start + index + 1 }));
    commitBlocks([...blocks, ...prepared]);
    setSelectedBlockId(prepared[0]?.id ?? null);
  }

  function replaceWithTemplate(templateId: PageStarterTemplateId) {
    if (blocks.length && !window.confirm("現在のブロックをテンプレートへ置き換えますか？")) return;
    const next = createStarterTemplate(templateId);
    commitBlocks(next);
    setSelectedBlockId(next[0]?.id ?? null);
  }

  function save() {
    setMessage("");
    try {
      const savedSite = savePageSiteTheme(params.siteId, theme);
      const saved = savePageDocument(params.siteId, params.pageId, { title, slug, mode, blocks, htmlDocument });
      if (saved) {
        setDocument(saved);
        setBlocks(saved.blocks);
      }
      setSite(savedSite);
      setPast([]);
      setFuture([]);
      setDirty(false);
      setMessage("下書きを保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "下書きを保存できませんでした。");
    }
  }

  if (!loaded) return <MikkeAppShell appName="Page" title="ページを編集" subtitle="読み込み中" currentApp={{ label: "Page", href: "/apps/page" }}><p className="text-sm text-[var(--mikke-muted)]">ページを読み込んでいます。</p></MikkeAppShell>;
  if (!site || !document) return <MikkeAppShell appName="Page" title="ページを編集" subtitle="ページが見つかりません" currentApp={{ label: "Page", href: "/apps/page" }}><section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5"><p className="text-sm text-[var(--mikke-muted)]">このページは見つかりませんでした。</p><Link href="/apps/page" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--mikke-accent)]"><ArrowLeft size={16} /> Page一覧へ戻る</Link></section></MikkeAppShell>;

  return (
    <MikkeAppShell appName="Page" title={document.title} subtitle={`${site.name}のホームページビルダー`} currentApp={{ label: "Page", href: "/apps/page" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/apps/page/${site.id}`} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold"><ArrowLeft size={15} /> ページ一覧へ</Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-bold ${dirty ? "text-[var(--mikke-accent)]" : "text-[var(--mikke-success)]"}`}>{dirty ? "未保存の変更があります" : "保存済み"}</span>
          <button type="button" onClick={undo} disabled={!past.length || mode !== "builder"} aria-label="元に戻す" className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white disabled:opacity-30"><Undo2 size={16} /></button>
          <button type="button" onClick={redo} disabled={!future.length || mode !== "builder"} aria-label="やり直す" className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white disabled:opacity-30"><Redo2 size={16} /></button>
          <button type="button" onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white"><Save size={16} /> 下書きを保存</button>
        </div>
      </div>

      {message ? <p role="status" className="mt-4 rounded-xl bg-[var(--mikke-primary-soft)] px-4 py-3 text-sm font-bold text-[var(--mikke-accent)]">{message}</p> : null}

      <section className="mt-5 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_220px]">
          <label className="block"><span className="text-xs font-bold">ページ名 *</span><input value={title} onChange={(event) => { setTitle(event.target.value); setDirty(true); }} className={inputClass} maxLength={80} /></label>
          <label className="block"><span className="text-xs font-bold">ページslug *</span><input value={slug} onChange={(event) => { setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").replace(/^-/, "")); setDirty(true); }} onBlur={() => setSlug((current) => normalizePageSiteSlug(current))} className={inputClass} /></label>
          <label className="block"><span className="text-xs font-bold">ページ形式</span><select value={mode} onChange={(event) => { setMode(event.target.value as PageDocumentMode); setDirty(true); }} className={inputClass}><option value="builder">かんたんビルダー</option><option value="html">AI HTMLページ</option></select></label>
        </div>
      </section>

      {mode === "html" ? (
        <HtmlPageEditor value={htmlDocument} onChange={(next) => { setHtmlDocument(next); setDirty(true); }} preview={<PageRenderer document={previewDocument} theme={theme} cmsContent={cmsContent} />} />
      ) : (
        <div className="mt-5 grid gap-5 min-[1180px]:grid-cols-[260px_minmax(390px,1fr)_minmax(330px,.78fr)]">
          <BuilderSidebar theme={theme} onThemeChange={(next) => { setTheme(next); setDirty(true); }} onStarter={replaceWithTemplate} onSection={(templateId) => addBlocks(createSectionTemplate(templateId, blocks.length + 1))} onBlock={(type) => addBlocks([createEmptyPageBlock(type, blocks.length + 1)])} />

          <main className="min-w-0 space-y-3">
            {blocks.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-10 text-center"><p className="font-bold">テンプレートまたはブロックを選んでください</p><p className="mt-2 text-sm text-[var(--mikke-muted)]">左側から、作りたいページに近いものを選べます。</p></div> : blocks.map((block, index) => {
              const selected = block.id === selectedBlockId;
              const label = pageBlockChoices.find((choice) => choice.type === block.type)?.label ?? "ブロック";
              return <article key={block.id} className={`rounded-2xl border bg-white shadow-sm ${selected ? "border-[var(--mikke-accent)] ring-2 ring-[var(--mikke-accent-soft)]" : "border-[var(--mikke-line)]"}`}>
                <button type="button" onClick={() => setSelectedBlockId(selected ? null : block.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left"><span><span className="text-xs font-bold text-[var(--mikke-accent)]">{index + 1}. {label}</span>{block.hidden ? <span className="ml-2 rounded-full bg-[var(--mikke-surface-soft)] px-2 py-1 text-[10px] font-bold text-[var(--mikke-muted)]">非表示</span> : null}</span>{selected ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                {selected ? <div className="border-t border-[var(--mikke-line-soft)] p-4"><PageBlockFields block={block} siteId={site.id} cmsContent={cmsContent} onChange={(next) => updateBlock(block.id, next)} /><PageBlockStyleFields block={block} onChange={(next) => updateBlock(block.id, next)} /></div> : null}
                <div className="flex flex-wrap items-center justify-end gap-1 border-t border-[var(--mikke-line-soft)] px-3 py-2">
                  <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} aria-label="上へ" className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} aria-label="下へ" className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] disabled:opacity-30"><ArrowDown size={14} /></button>
                  <button type="button" onClick={() => updateBlock(block.id, { ...block, hidden: !block.hidden })} aria-label={block.hidden ? "表示する" : "非表示にする"} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)]">{block.hidden ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  <button type="button" onClick={() => { const copy = renewNestedIds(block); commitBlocks([...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)]); setSelectedBlockId(copy.id); }} aria-label="複製" className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)]"><Copy size={14} /></button>
                  <button type="button" onClick={() => { commitBlocks(blocks.filter((item) => item.id !== block.id)); if (selected) setSelectedBlockId(null); }} aria-label="削除" className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] text-[var(--mikke-danger)]"><Trash2 size={14} /></button>
                </div>
              </article>;
            })}
          </main>

          <aside className="min-[1180px]:sticky min-[1180px]:top-24 min-[1180px]:self-start">
            <div className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Eye size={16} className="text-[var(--mikke-accent)]" /><h2 className="text-sm font-bold">ライブプレビュー</h2></div><div className="flex gap-1"><DeviceButton active={device === "desktop"} label="PC" onClick={() => setDevice("desktop")} icon={<Laptop size={14} />} /><DeviceButton active={device === "tablet"} label="タブレット" onClick={() => setDevice("tablet")} icon={<Tablet size={14} />} /><DeviceButton active={device === "mobile"} label="スマホ" onClick={() => setDevice("mobile")} icon={<Smartphone size={14} />} /></div></div>
              <div className="mt-3 overflow-auto rounded-xl bg-[#dfe3ea] p-3"><div className={`mx-auto overflow-hidden rounded-xl bg-white shadow-lg transition-[width] ${device === "desktop" ? "w-full" : device === "tablet" ? "w-[720px] max-w-full" : "w-[390px] max-w-full"}`}><PageRenderer compact document={previewDocument} theme={theme} cmsContent={cmsContent} /></div></div>
            </div>
          </aside>
        </div>
      )}
    </MikkeAppShell>
  );
}

function BuilderSidebar({ theme, onThemeChange, onStarter, onSection, onBlock }: { theme: PageSiteTheme; onThemeChange: (theme: PageSiteTheme) => void; onStarter: (id: PageStarterTemplateId) => void; onSection: (id: PageSectionTemplateId) => void; onBlock: (type: PageBlock["type"]) => void }) {
  return <aside className="space-y-4 min-[1180px]:sticky min-[1180px]:top-24 min-[1180px]:self-start">
    <details open className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm"><summary className="cursor-pointer text-sm font-bold">サイトデザイン</summary><div className="mt-3 grid gap-3"><label className="block"><span className="text-xs font-bold">雰囲気</span><select value={theme.presetId} onChange={(event) => onThemeChange({ ...pageThemePresets[event.target.value as keyof typeof pageThemePresets] })} className={inputClass}><option value="gothic">すっきり</option><option value="soft">やわらかい</option><option value="serif">上品</option><option value="modern">モダン</option></select></label><div className="grid grid-cols-2 gap-2"><ColorField label="メイン" value={theme.primaryColor} onChange={(primaryColor) => onThemeChange({ ...theme, primaryColor })} /><ColorField label="アクセント" value={theme.accentColor} onChange={(accentColor) => onThemeChange({ ...theme, accentColor })} /><ColorField label="背景" value={theme.backgroundColor} onChange={(backgroundColor) => onThemeChange({ ...theme, backgroundColor })} /><ColorField label="文字" value={theme.textColor} onChange={(textColor) => onThemeChange({ ...theme, textColor })} /></div><label className="block"><span className="text-xs font-bold">コンテンツ幅</span><select value={theme.contentWidth} onChange={(event) => onThemeChange({ ...theme, contentWidth: event.target.value as PageSiteTheme["contentWidth"] })} className={inputClass}><option value="narrow">読み物向け</option><option value="standard">標準</option><option value="wide">ワイド</option></select></label></div></details>
    <details className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm"><summary className="cursor-pointer text-sm font-bold">ページテンプレート</summary><div className="mt-3 grid gap-2">{starterTemplates.map((template) => <button key={template.id} type="button" onClick={() => onStarter(template.id)} className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3 text-left"><strong className="block text-xs">{template.label}</strong><span className="mt-1 block text-[10px] leading-4 text-[var(--mikke-muted)]">{template.helper}</span></button>)}</div></details>
    <details open className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm"><summary className="cursor-pointer text-sm font-bold">セクションテンプレート</summary><div className="mt-3 grid grid-cols-2 gap-2">{sectionTemplates.map((template) => <button key={template.id} type="button" onClick={() => onSection(template.id)} className="rounded-lg border border-[var(--mikke-line)] px-2 py-2 text-xs font-bold">{template.label}</button>)}</div></details>
    <details className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm"><summary className="cursor-pointer text-sm font-bold">パーツを追加</summary><div className="mt-3 grid grid-cols-2 gap-2">{pageBlockChoices.map((choice) => { const Icon = choice.icon; return <button key={choice.type} type="button" onClick={() => onBlock(choice.type)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--mikke-line)] px-2 py-2 text-[11px] font-bold"><Icon size={14} />{choice.label}</button>; })}</div></details>
  </aside>;
}

function HtmlPageEditor({ value, onChange, preview }: { value: PageHtmlDocument; onChange: (value: PageHtmlDocument) => void; preview: React.ReactNode }) {
  return <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(420px,.8fr)_minmax(0,1fr)]"><section className="space-y-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm"><div><h2 className="text-lg font-bold">AI HTMLページ</h2><p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">AIが作ったHTML・CSS・JavaScriptを貼り付けます。コードはmikkeOSから隔離して表示されます。</p></div><CodeField label="HTML" value={value.html} rows={12} onChange={(html) => onChange({ ...value, html })} /><CodeField label="CSS" value={value.css} rows={10} onChange={(css) => onChange({ ...value, css })} /><label className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold"><input type="checkbox" checked={value.allowScripts} onChange={(event) => onChange({ ...value, allowScripts: event.target.checked })} /> JavaScriptを有効にする</label>{value.allowScripts ? <CodeField label="JavaScript" value={value.javascript} rows={8} onChange={(javascript) => onChange({ ...value, javascript })} /> : null}</section><aside className="xl:sticky xl:top-24 xl:self-start"><div className="overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white shadow-sm"><div className="border-b border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] px-4 py-3 text-sm font-bold">安全プレビュー</div>{preview}</div></aside></div>;
}

function DeviceButton({ active, label, onClick, icon }: { active: boolean; label: string; onClick: () => void; icon: React.ReactNode }) { return <button type="button" onClick={onClick} aria-label={label} className={`grid h-8 w-8 place-items-center rounded-lg border ${active ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary)] text-white" : "border-[var(--mikke-line)] bg-white"}`}>{icon}</button>; }
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="text-[10px] font-bold">{label}</span><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-[var(--mikke-line)] bg-white p-1" /></label>; }
function CodeField({ label, value, rows, onChange }: { label: string; value: string; rows: number; onChange: (value: string) => void }) { return <label className="block"><span className="text-xs font-bold">{label}</span><textarea spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className={`${inputClass} resize-y font-mono text-xs leading-5`} /></label>; }
