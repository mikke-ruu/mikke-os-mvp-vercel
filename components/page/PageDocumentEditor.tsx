"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Globe2,
  Laptop,
  LayoutTemplate,
  ListPlus,
  Palette,
  PanelRight,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Type,
  Undo2
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import {
  PageBlockFields,
  PageBlockStyleFields,
  createEmptyPageBlock,
  createPageBuilderId,
  pageBlockChoices
} from "./PageBlockEditor";
import { PageDeviceFrame, type PageViewportDevice, type PageZoomMode } from "./PageDeviceFrame";
import { PageRenderer } from "./PageRenderer";
import { PageTemplatePreview } from "./PageTemplatePreview";
import { analyzePageHtmlPayload, PAGE_HTML_MAX_BYTES } from "@/lib/page/html";
import { syncMikkeMediaUsages } from "@/lib/media/client";
import { usePageCmsContent, type PageCmsItem } from "@/lib/page/cms-selectors";
import { pageJpFontOrder, pageJpFonts, pageLatinFontOrder, pageLatinFonts } from "@/lib/page/fonts";
import { applyPagePaletteToTheme, findMatchingPagePaletteId, pagePalettes } from "@/lib/page/palettes";
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
  PageCmsSource,
  PageJpFontId,
  PageLatinFontId,
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
  const router = useRouter();
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
  const [device, setDevice] = useState<PageViewportDevice>("desktop");
  const [zoomMode, setZoomMode] = useState<PageZoomMode>("auto");
  const [mobileWorkspace, setMobileWorkspace] = useState<"preview" | "edit" | "add">("preview");
  const [sidebarPanel, setSidebarPanel] = useState<"templates" | "sections" | "parts" | "design">("sections");
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

  async function save(): Promise<boolean> {
    setMessage("");
    try {
      const savedSite = savePageSiteTheme(params.siteId, theme);
      const saved = savePageDocument(params.siteId, params.pageId, { title, slug, mode, blocks, htmlDocument });
      await syncMikkeMediaUsages({ appKey: "page", entityType: "page_document", entityId: params.pageId, assetIds: mode === "builder" ? collectPageMediaAssetIds(blocks) : [] });
      if (saved) {
        setDocument(saved);
        setBlocks(saved.blocks);
      }
      setSite(savedSite);
      setPast([]);
      setFuture([]);
      setDirty(false);
      setMessage("下書きを保存しました。");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "下書きを保存できませんでした。");
      return false;
    }
  }

  async function openSitePreview() {
    if (!site || !document) return;
    if (dirty) {
      const saved = await save();
      if (!saved) return;
    }
    router.push(`/apps/page/${site.id}/preview?page=${document.slug}`);
  }

  if (!loaded) return <MikkeAppShell appName="Page" title="ページを編集" subtitle="読み込み中" currentApp={{ label: "Page", href: "/apps/page" }}><p className="text-sm text-[var(--mikke-muted)]">ページを読み込んでいます。</p></MikkeAppShell>;
  if (!site || !document) return <MikkeAppShell appName="Page" title="ページを編集" subtitle="ページが見つかりません" currentApp={{ label: "Page", href: "/apps/page" }}><section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5"><p className="text-sm text-[var(--mikke-muted)]">このページは見つかりませんでした。</p><Link href="/apps/page" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--mikke-accent)]"><ArrowLeft size={16} /> Page一覧へ戻る</Link></section></MikkeAppShell>;

  return (
    <MikkeAppShell appName="Page" title={document.title} subtitle={`${site.name}のホームページビルダー`} currentApp={{ label: "Page", href: "/apps/page" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/apps/page/${site.id}`} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold"><ArrowLeft size={15} /> ページ一覧へ</Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-bold ${dirty ? "text-[var(--mikke-accent)]" : "text-[var(--mikke-success)]"}`}>{dirty ? "未保存の変更があります" : "保存済み"}</span>
          <button type="button" onClick={() => void openSitePreview()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-muted)]"><Globe2 size={15} /> サイトを表示</button>
          <button type="button" onClick={undo} disabled={!past.length || mode !== "builder"} aria-label="元に戻す" className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white disabled:opacity-30"><Undo2 size={16} /></button>
          <button type="button" onClick={redo} disabled={!future.length || mode !== "builder"} aria-label="やり直す" className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white disabled:opacity-30"><Redo2 size={16} /></button>
          <button type="button" onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white"><Save size={16} /> 下書きを保存</button>
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
        <>
          <nav className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-[var(--mikke-line)] bg-white p-2 shadow-sm lg:hidden" aria-label="スマホ編集メニュー">
            <WorkspaceButton active={mobileWorkspace === "preview"} label="見る" icon={<Eye size={16} />} onClick={() => setMobileWorkspace("preview")} />
            <WorkspaceButton active={mobileWorkspace === "edit"} label="編集" icon={<PanelRight size={16} />} onClick={() => setMobileWorkspace("edit")} />
            <WorkspaceButton active={mobileWorkspace === "add"} label="追加・デザイン" icon={<ListPlus size={16} />} onClick={() => setMobileWorkspace("add")} />
          </nav>

          <div className={`mt-4 grid gap-4 ${mobileWorkspace === "add" ? "lg:grid-cols-[280px_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_360px]"} xl:grid-cols-[250px_minmax(0,1fr)_360px]`}>
            <div className={`${mobileWorkspace === "add" ? "block" : "hidden"} ${mobileWorkspace === "add" ? "lg:block" : "lg:hidden"} xl:block`}>
              <BuilderSidebar panel={sidebarPanel} onPanelChange={setSidebarPanel} theme={theme} onThemeChange={(next) => { setTheme(next); setDirty(true); }} onStarter={replaceWithTemplate} onSection={(templateId) => addBlocks(createSectionTemplate(templateId, blocks.length + 1))} onBlock={(type) => addBlocks([createEmptyPageBlock(type, blocks.length + 1)])} />
            </div>

            <main className={`${mobileWorkspace === "preview" ? "block" : "hidden"} min-w-0 lg:block`}>
              <section className="overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--mikke-line-soft)] px-3 py-2.5">
                  <div><h2 className="text-sm font-bold">ページを見ながら編集</h2><p className="mt-0.5 text-[10px] text-[var(--mikke-muted)]">変更したい場所をプレビュー内で選べます</p></div>
                  <div className="flex items-center gap-1">
                    <DeviceButton active={device === "desktop"} label="PC" onClick={() => setDevice("desktop")} icon={<Laptop size={14} />} />
                    <DeviceButton active={device === "tablet"} label="タブレット" onClick={() => setDevice("tablet")} icon={<Tablet size={14} />} />
                    <DeviceButton active={device === "mobile"} label="スマホ" onClick={() => setDevice("mobile")} icon={<Smartphone size={14} />} />
                    <select aria-label="プレビュー倍率" value={String(zoomMode)} onChange={(event) => setZoomMode(event.target.value === "auto" ? "auto" : (Number(event.target.value) as PageZoomMode))} className="ml-1 h-8 rounded-lg border border-[var(--mikke-line)] bg-white px-2 text-[11px] font-bold"><option value="auto">自動</option><option value={50}>50%</option><option value={60}>60%</option><option value={75}>75%</option><option value={100}>100%</option></select>
                  </div>
                </div>
                <div className="min-h-[620px] overflow-auto bg-[var(--mikke-surface-soft)] p-3 sm:p-6">
                  {blocks.length === 0 ? <div className="grid min-h-[560px] place-items-center"><div className="max-w-sm text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-[var(--mikke-accent)] shadow-sm"><LayoutTemplate size={22} /></span><p className="mt-4 font-bold">最初のデザインを選びましょう</p><p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">「追加・デザイン」からテンプレートを選ぶと、すぐに編集できます。</p><button type="button" onClick={() => { setSidebarPanel("templates"); setMobileWorkspace("add"); }} className="mt-4 rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white">テンプレートを見る</button></div></div> : (
                    <PageDeviceFrame device={device} zoomMode={zoomMode} mode="content">
                      <div className="overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/5">
                        <PageRenderer document={previewDocument} theme={theme} cmsContent={cmsContent} viewport={device} editor={{ selectedBlockId, onSelectBlock: (blockId) => { setSelectedBlockId(blockId); if (window.innerWidth < 1024) setMobileWorkspace("edit"); } }} sitePages={site.documents.map((item) => ({ id: item.id, title: item.title, slug: item.slug }))} activeDocumentId={document.id} />
                      </div>
                    </PageDeviceFrame>
                  )}
                </div>
              </section>
            </main>

            <div className={`${mobileWorkspace === "edit" ? "block" : "hidden"} ${mobileWorkspace === "add" ? "lg:hidden" : "lg:block"} xl:block`}>
              <BlockInspector siteId={site.id} blocks={blocks} selectedBlockId={selectedBlockId} onSelectBlock={setSelectedBlockId} cmsContent={cmsContent} onChangeBlock={updateBlock} onMoveBlock={moveBlock} onDuplicate={(block, index) => { const copy = renewNestedIds(block); commitBlocks([...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)]); setSelectedBlockId(copy.id); }} onDelete={(blockId) => { commitBlocks(blocks.filter((item) => item.id !== blockId)); setSelectedBlockId(null); }} />
            </div>
          </div>
        </>
      )}
    </MikkeAppShell>
  );
}

type BuilderPanel = "templates" | "sections" | "parts" | "design";

function BuilderSidebar({ panel, onPanelChange, theme, onThemeChange, onStarter, onSection, onBlock }: { panel: BuilderPanel; onPanelChange: (panel: BuilderPanel) => void; theme: PageSiteTheme; onThemeChange: (theme: PageSiteTheme) => void; onStarter: (id: PageStarterTemplateId) => void; onSection: (id: PageSectionTemplateId) => void; onBlock: (type: PageBlock["type"]) => void }) {
  const tabs: { id: BuilderPanel; label: string; icon: React.ReactNode }[] = [
    { id: "templates", label: "ひな形", icon: <LayoutTemplate size={15} /> },
    { id: "sections", label: "セット", icon: <ListPlus size={15} /> },
    { id: "parts", label: "パーツ", icon: <PanelRight size={15} /> },
    { id: "design", label: "デザイン", icon: <Palette size={15} /> }
  ];
  return <aside className="overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white shadow-sm xl:sticky xl:top-24 xl:self-start">
    <nav className="grid grid-cols-4 border-b border-[var(--mikke-line-soft)] p-1.5">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => onPanelChange(tab.id)} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-bold ${panel === tab.id ? "bg-[var(--mikke-primary)] text-white" : "text-[var(--mikke-muted)] hover:bg-[var(--mikke-surface-soft)]"}`}>{tab.icon}<span>{tab.label}</span></button>)}</nav>
    <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-3">
      {panel === "templates" ? <div><h2 className="text-sm font-bold">ページのひな形</h2><p className="mt-1 text-[10px] leading-4 text-[var(--mikke-muted)]">ページ全体を置き換えます。</p><div className="mt-3 grid gap-3">{starterTemplates.map((template) => <button key={template.id} type="button" onClick={() => onStarter(template.id)} className="rounded-xl border border-[var(--mikke-line)] p-2 text-left transition hover:border-[var(--mikke-accent)]"><PageTemplatePreview templateId={template.id} /><strong className="mt-2 block text-xs">{template.label}</strong><span className="mt-1 block text-[10px] leading-4 text-[var(--mikke-muted)]">{template.helper}</span></button>)}</div></div> : null}
      {panel === "sections" ? <div><h2 className="text-sm font-bold">よく使うページ要素</h2><p className="mt-1 text-[10px] leading-4 text-[var(--mikke-muted)]">まとまった内容をワンタップで追加。</p><div className="mt-3 grid grid-cols-2 gap-2">{sectionTemplates.map((template) => <button key={template.id} type="button" onClick={() => onSection(template.id)} className="min-h-20 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-2 py-3 text-xs font-bold transition hover:border-[var(--mikke-accent)] hover:bg-white">{template.label}</button>)}</div></div> : null}
      {panel === "parts" ? <div><h2 className="text-sm font-bold">パーツを1つ追加</h2><p className="mt-1 text-[10px] leading-4 text-[var(--mikke-muted)]">必要なものだけ自由に組み合わせます。</p><div className="mt-3 grid grid-cols-2 gap-2">{pageBlockChoices.map((choice) => { const Icon = choice.icon; return <button key={choice.type} type="button" onClick={() => onBlock(choice.type)} className="inline-flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--mikke-line)] px-2 py-2 text-[10px] font-bold text-[var(--mikke-accent)] hover:border-[var(--mikke-accent)]"><Icon size={17} /><span className="text-[var(--mikke-text)]">{choice.label}</span></button>; })}</div></div> : null}
      {panel === "design" ? <DesignPanel theme={theme} onThemeChange={onThemeChange} /> : null}
    </div>
  </aside>;
}

function DesignPanel({ theme, onThemeChange }: { theme: PageSiteTheme; onThemeChange: (theme: PageSiteTheme) => void }) {
  const [tab, setTab] = useState<"color" | "font">("color");
  const activePaletteId = findMatchingPagePaletteId(theme);
  return <div>
    <h2 className="text-sm font-bold">サイトデザイン</h2>
    <p className="mt-1 text-[10px] leading-4 text-[var(--mikke-muted)]">全ページ共通の雰囲気を整えます。</p>
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-[var(--mikke-surface-soft)] p-1">
      <button type="button" onClick={() => setTab("color")} className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${tab === "color" ? "bg-white text-[var(--mikke-primary)] shadow-sm" : "text-[var(--mikke-muted)]"}`}><Palette size={13} /> カラー</button>
      <button type="button" onClick={() => setTab("font")} className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${tab === "font" ? "bg-white text-[var(--mikke-primary)] shadow-sm" : "text-[var(--mikke-muted)]"}`}><Type size={13} /> フォント</button>
    </div>

    {tab === "color" ? (
      <div className="mt-4 grid gap-4">
        <div>
          <span className="text-xs font-bold">カラーパレット</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {pagePalettes.map((palette) => (
              <button
                key={palette.id}
                type="button"
                onClick={() => onThemeChange(applyPagePaletteToTheme(theme, palette))}
                className={`rounded-xl border p-2 text-left transition ${activePaletteId === palette.id ? "border-[var(--mikke-accent)] ring-2 ring-[var(--mikke-accent-soft)]" : "border-[var(--mikke-line)] hover:border-[var(--mikke-accent)]"}`}
              >
                <span className="flex gap-1">
                  <span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: palette.backgroundColor }} />
                  <span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: palette.primaryColor }} />
                  <span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: palette.accentColor }} />
                </span>
                <span className="mt-1.5 block text-[11px] font-bold">{palette.name}</span>
              </button>
            ))}
          </div>
        </div>
        <details className="rounded-xl border border-[var(--mikke-line-soft)] p-3">
          <summary className="cursor-pointer text-xs font-bold">色を個別に調整</summary>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ColorField label="メイン" value={theme.primaryColor} onChange={(primaryColor) => onThemeChange({ ...theme, primaryColor })} />
            <ColorField label="アクセント" value={theme.accentColor} onChange={(accentColor) => onThemeChange({ ...theme, accentColor })} />
            <ColorField label="背景" value={theme.backgroundColor} onChange={(backgroundColor) => onThemeChange({ ...theme, backgroundColor })} />
            <ColorField label="文字" value={theme.textColor} onChange={(textColor) => onThemeChange({ ...theme, textColor })} />
          </div>
        </details>
        <label className="block"><span className="text-xs font-bold">コンテンツ幅</span><select value={theme.contentWidth} onChange={(event) => onThemeChange({ ...theme, contentWidth: event.target.value as PageSiteTheme["contentWidth"] })} className={inputClass}><option value="narrow">読み物向け</option><option value="standard">標準</option><option value="wide">ワイド</option></select></label>
        <label className="block"><span className="text-xs font-bold">ボタンの形</span><select value={theme.buttonStyle} onChange={(event) => onThemeChange({ ...theme, buttonStyle: event.target.value as PageSiteTheme["buttonStyle"] })} className={inputClass}><option value="rounded">角丸</option><option value="pill">ピル</option><option value="square">角ばり</option></select></label>
        <details className="rounded-xl border border-[var(--mikke-line-soft)] p-3">
          <summary className="cursor-pointer text-xs font-bold">おまかせセットから選ぶ（色＋フォントを一括変更）</summary>
          <select value="" onChange={(event) => { if (event.target.value) onThemeChange({ ...pageThemePresets[event.target.value as keyof typeof pageThemePresets] }); }} className={inputClass}>
            <option value="">セットを選択…</option>
            <option value="gothic">すっきり</option>
            <option value="soft">やわらかい</option>
            <option value="serif">上品</option>
            <option value="modern">モダン</option>
          </select>
        </details>
      </div>
    ) : (
      <div className="mt-4 grid gap-4">
        <div>
          <p className="text-xs font-bold">見出し用フォント</p>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <label className="block"><span className="text-[10px] font-bold">日本語</span><select value={theme.headingJpFontId ?? ""} onChange={(event) => onThemeChange({ ...theme, headingJpFontId: (event.target.value || undefined) as PageJpFontId | undefined })} className={inputClass}><option value="">（既定のフォント文字列を使う）</option>{pageJpFontOrder.map((id) => <option key={id} value={id}>{pageJpFonts[id].label}（{pageJpFonts[id].helper}）</option>)}</select></label>
            <label className="block"><span className="text-[10px] font-bold">欧文</span><select value={theme.headingLatinFontId ?? "none"} onChange={(event) => onThemeChange({ ...theme, headingLatinFontId: event.target.value as PageLatinFontId })} className={inputClass}>{pageLatinFontOrder.map((id) => <option key={id} value={id}>{pageLatinFonts[id].label}</option>)}</select></label>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold">本文用フォント</p>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <label className="block"><span className="text-[10px] font-bold">日本語</span><select value={theme.bodyJpFontId ?? ""} onChange={(event) => onThemeChange({ ...theme, bodyJpFontId: (event.target.value || undefined) as PageJpFontId | undefined })} className={inputClass}><option value="">（既定のフォント文字列を使う）</option>{pageJpFontOrder.map((id) => <option key={id} value={id}>{pageJpFonts[id].label}（{pageJpFonts[id].helper}）</option>)}</select></label>
            <label className="block"><span className="text-[10px] font-bold">欧文</span><select value={theme.bodyLatinFontId ?? "none"} onChange={(event) => onThemeChange({ ...theme, bodyLatinFontId: event.target.value as PageLatinFontId })} className={inputClass}>{pageLatinFontOrder.map((id) => <option key={id} value={id}>{pageLatinFonts[id].label}</option>)}</select></label>
          </div>
        </div>
        <p className="text-[10px] leading-4 text-[var(--mikke-muted)]">日本語×欧文を自由に組み合わせられます。欧文フォントを選ぶと英数字だけそのフォントになり、日本語部分は日本語フォントで表示されます。ブロックごとの上書きは各パーツの編集画面から行えます。</p>
      </div>
    )}
  </div>;
}

function BlockInspector({ siteId, blocks, selectedBlockId, onSelectBlock, cmsContent, onChangeBlock, onMoveBlock, onDuplicate, onDelete }: { siteId: string; blocks: PageBlock[]; selectedBlockId: string | null; onSelectBlock: (id: string | null) => void; cmsContent: Record<PageCmsSource, PageCmsItem[]>; onChangeBlock: (id: string, block: PageBlock) => void; onMoveBlock: (index: number, direction: -1 | 1) => void; onDuplicate: (block: PageBlock, index: number) => void; onDelete: (id: string) => void }) {
  const index = blocks.findIndex((block) => block.id === selectedBlockId);
  const block = index >= 0 ? blocks[index] : null;
  return <aside className="overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white shadow-sm xl:sticky xl:top-24 xl:self-start">
    <div className="border-b border-[var(--mikke-line-soft)] px-4 py-3"><div className="flex items-center gap-2"><PanelRight size={16} className="text-[var(--mikke-accent)]" /><h2 className="text-sm font-bold">内容を編集</h2></div><p className="mt-1 text-[10px] text-[var(--mikke-muted)]">プレビューをクリックすると、その場所を編集できます。</p></div>
    <div className="max-h-[calc(100vh-210px)] overflow-y-auto p-3">
      {!blocks.length ? <div className="rounded-xl bg-[var(--mikke-surface-soft)] p-5 text-center text-xs leading-5 text-[var(--mikke-muted)]">まだ編集するパーツがありません。追加メニューから選んでください。</div> : !block ? <div><p className="px-1 text-xs font-bold">編集する場所を選択</p><div className="mt-2 space-y-1.5">{blocks.map((item, itemIndex) => { const label = pageBlockChoices.find((choice) => choice.type === item.type)?.label ?? "ブロック"; return <button key={item.id} type="button" onClick={() => onSelectBlock(item.id)} className="flex w-full items-center justify-between rounded-xl border border-[var(--mikke-line)] px-3 py-3 text-left text-xs font-bold hover:border-[var(--mikke-accent)]"><span>{itemIndex + 1}. {label}</span>{item.hidden ? <EyeOff size={13} className="text-[var(--mikke-muted)]" /> : <ArrowRight size={13} />}</button>; })}</div></div> : <div>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--mikke-primary-soft)] px-3 py-2"><div><p className="text-[10px] font-bold text-[var(--mikke-accent)]">選択中</p><p className="text-xs font-bold">{index + 1}. {pageBlockChoices.find((choice) => choice.type === block.type)?.label ?? "ブロック"}</p></div><button type="button" onClick={() => onSelectBlock(null)} className="rounded-lg border border-[var(--mikke-line)] bg-white px-2 py-1.5 text-[10px] font-bold">一覧</button></div>
        <div className="mt-4"><PageBlockFields block={block} siteId={siteId} cmsContent={cmsContent} onChange={(next) => onChangeBlock(block.id, next)} /><PageBlockStyleFields block={block} onChange={(next) => onChangeBlock(block.id, next)} /></div>
        <div className="sticky bottom-0 mt-4 flex items-center justify-end gap-1 border-t border-[var(--mikke-line-soft)] bg-white py-3">
          <button type="button" onClick={() => onMoveBlock(index, -1)} disabled={index === 0} aria-label="上へ" className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)] disabled:opacity-30"><ArrowUp size={14} /></button>
          <button type="button" onClick={() => onMoveBlock(index, 1)} disabled={index === blocks.length - 1} aria-label="下へ" className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)] disabled:opacity-30"><ArrowDown size={14} /></button>
          <button type="button" onClick={() => onChangeBlock(block.id, { ...block, hidden: !block.hidden })} aria-label={block.hidden ? "表示する" : "非表示にする"} className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)]">{block.hidden ? <Eye size={14} /> : <EyeOff size={14} />}</button>
          <button type="button" onClick={() => onDuplicate(block, index)} aria-label="複製" className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)]"><Copy size={14} /></button>
          <button type="button" onClick={() => onDelete(block.id)} aria-label="削除" className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)] text-[var(--mikke-danger)]"><Trash2 size={14} /></button>
        </div>
      </div>}
    </div>
  </aside>;
}

function collectPageMediaAssetIds(blocks: PageBlock[]) {
  const ids: string[] = [];
  for (const block of blocks) {
    if (block.type === "image" && block.asset?.mediaAssetId) ids.push(block.asset.mediaAssetId);
    if (block.type === "columns") for (const column of block.columns) if (column.asset?.mediaAssetId) ids.push(column.asset.mediaAssetId);
    if (block.type === "gallery" || block.type === "slideshow") for (const image of block.images) if (image.asset?.mediaAssetId) ids.push(image.asset.mediaAssetId);
  }
  return [...new Set(ids)];
}

function HtmlPageEditor({ value, onChange, preview }: { value: PageHtmlDocument; onChange: (value: PageHtmlDocument) => void; preview: React.ReactNode }) {
  const payload = analyzePageHtmlPayload(value);
  const usedKb = Math.max(1, Math.ceil(payload.bytes / 1024));
  const limitKb = Math.round(PAGE_HTML_MAX_BYTES / 1024);
  return <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(420px,.8fr)_minmax(0,1fr)]"><section className="space-y-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm"><div><h2 className="text-lg font-bold">AI HTMLページ</h2><p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">AIが作ったHTML・CSS・JavaScriptを貼り付けます。コードはmikkeOSから隔離して表示されます。</p></div><div className={`rounded-xl border p-3 text-xs leading-5 ${payload.hasEmbeddedData || payload.bytes > PAGE_HTML_MAX_BYTES ? "border-[var(--mikke-danger)] bg-[var(--mikke-surface-soft)] text-[var(--mikke-danger)]" : "border-[var(--mikke-primary-border)] bg-[var(--mikke-primary-soft)] text-[var(--mikke-accent)]"}`}><strong>コード容量 {usedKb}KB / {limitKb}KB</strong><p>HTML文字は小容量です。外部画像・動画は表示元の通信を使い、Mikke MediaのURLならSupabase通信として計上されます。</p><p>base64画像・フォントの直接埋め込みは保存できません。画像はMikke Mediaを使ってください。</p></div><CodeField label="HTML" value={value.html} rows={12} onChange={(html) => onChange({ ...value, html })} /><CodeField label="CSS" value={value.css} rows={10} onChange={(css) => onChange({ ...value, css })} /><label className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold"><input type="checkbox" checked={value.allowScripts} onChange={(event) => onChange({ ...value, allowScripts: event.target.checked })} /> JavaScriptを有効にする</label>{value.allowScripts ? <CodeField label="JavaScript" value={value.javascript} rows={8} onChange={(javascript) => onChange({ ...value, javascript })} /> : null}</section><aside className="xl:sticky xl:top-24 xl:self-start"><div className="overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white shadow-sm"><div className="border-b border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] px-4 py-3 text-sm font-bold">安全プレビュー</div>{preview}</div></aside></div>;
}

function WorkspaceButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 text-xs font-bold ${active ? "bg-[var(--mikke-primary)] text-white" : "text-[var(--mikke-muted)]"}`}>{icon}{label}</button>; }
function DeviceButton({ active, label, onClick, icon }: { active: boolean; label: string; onClick: () => void; icon: React.ReactNode }) { return <button type="button" onClick={onClick} aria-label={label} className={`grid h-8 w-8 place-items-center rounded-lg border ${active ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary)] text-white" : "border-[var(--mikke-line)] bg-white"}`}>{icon}</button>; }
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="text-[10px] font-bold">{label}</span><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-[var(--mikke-line)] bg-white p-1" /></label>; }
function CodeField({ label, value, rows, onChange }: { label: string; value: string; rows: number; onChange: (value: string) => void }) { return <label className="block"><span className="text-xs font-bold">{label}</span><textarea spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className={`${inputClass} resize-y font-mono text-xs leading-5`} /></label>; }
