"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Database,
  Eye,
  FormInput,
  Heading,
  ImageIcon,
  Link2,
  Minus,
  Plus,
  Save,
  Trash2,
  Type
} from "lucide-react";
import { useParams } from "next/navigation";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { pageCmsSourceInfo, type PageCmsItem, usePageCmsContent } from "@/lib/page/cms-selectors";
import { getPageDocument, getPageSite, normalizePageSiteSlug, savePageDocument } from "@/lib/page/store";
import type { PageBlock, PageBlockType, PageCmsSource, PageDocument, PageSite } from "@/lib/page/types";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";

const blockChoices: { type: PageBlockType; label: string; icon: typeof Heading }[] = [
  { type: "heading", label: "見出し", icon: Heading },
  { type: "text", label: "文章", icon: Type },
  { type: "image", label: "画像", icon: ImageIcon },
  { type: "button", label: "ボタン", icon: Link2 },
  { type: "form", label: "フォーム枠", icon: FormInput },
  { type: "divider", label: "区切り", icon: Minus },
  { type: "cms", label: "自組織CMS", icon: Database }
];

const cmsSourceLabels: Record<PageCmsSource, string> = {
  story: "Story",
  item_studio: "Item Studio",
  event: "Event",
  academy: "Academy",
  session: "Session"
};

function createBlockId() {
  return `page_block_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyBlock(type: PageBlockType, order: number): PageBlock {
  const base = { id: createBlockId(), order };
  if (type === "heading") return { ...base, type, level: 2, text: "新しい見出し" };
  if (type === "text") return { ...base, type, text: "ここに文章を入力します。" };
  if (type === "image") return { ...base, type, imageUrl: "", alt: "", caption: "" };
  if (type === "button") return { ...base, type, label: "詳しく見る", href: "#" };
  if (type === "form") return { ...base, type, title: "お問い合わせ", description: "フォーム送信はまだ利用できません。", buttonLabel: "送信する" };
  if (type === "cms") return { ...base, type, source: "story", displayMode: "cards", title: "活動を見る", filters: {} };
  return { ...base, type: "divider" };
}

export function PageDocumentEditor() {
  const params = useParams<{ siteId: string; pageId: string }>();
  const [site, setSite] = useState<PageSite | null>(null);
  const [document, setDocument] = useState<PageDocument | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [message, setMessage] = useState("");
  const cmsContent = usePageCmsContent();

  useEffect(() => {
    const nextSite = getPageSite(params.siteId);
    const nextDocument = getPageDocument(params.siteId, params.pageId);
    setSite(nextSite);
    setDocument(nextDocument);
    setTitle(nextDocument?.title ?? "");
    setSlug(nextDocument?.slug ?? "");
    setBlocks(nextDocument?.blocks.slice().sort((a, b) => a.order - b.order) ?? []);
    setLoaded(true);
  }, [params.pageId, params.siteId]);

  function updateBlock(blockId: string, update: (block: PageBlock) => PageBlock) {
    setBlocks((current) => current.map((block) => (block.id === blockId ? update(block) : block)));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    setBlocks((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      const saved = savePageDocument(params.siteId, params.pageId, { title, slug, blocks });
      if (saved) {
        setDocument(saved);
        setBlocks(saved.blocks);
      }
      setMessage("下書きを保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "下書きを保存できませんでした。");
    }
  }

  return (
    <MikkeAppShell
      appName="Page"
      title={document?.title ?? "ページを編集"}
      subtitle={site ? `${site.name}の下書きページ` : "積み上げ式ブロック編集"}
      currentApp={{ label: "Page", href: "/apps/page" }}
    >
      {!loaded ? (
        <p className="text-sm text-[var(--mikke-muted)]">ページを読み込んでいます。</p>
      ) : !site || !document ? (
        <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
          <p className="text-sm text-[var(--mikke-muted)]">このページは見つかりませんでした。</p>
          <Link href="/apps/page" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--mikke-accent)]"><ArrowLeft size={16} /> Page一覧へ戻る</Link>
        </section>
      ) : (
        <form onSubmit={submit}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href={`/apps/page/${site.id}`} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold"><ArrowLeft size={15} /> ページ一覧へ</Link>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white"><Save size={16} /> 下書きを保存</button>
          </div>

          <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
            <div className="space-y-5">
              <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mikke-accent)]">PG-1-d</p>
                <h2 className="mt-1 text-lg font-bold tracking-normal">ページ設定</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block"><span className="text-xs font-bold">ページ名 *</span><input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} maxLength={80} required /></label>
                  <label className="block"><span className="text-xs font-bold">ページslug *</span><input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").replace(/^-/, ""))} onBlur={() => setSlug((current) => normalizePageSiteSlug(current))} className={inputClass} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} required /></label>
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold tracking-normal">ブロックを追加</h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">上から順に表示されます。自由配置は行いません。</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {blockChoices.map((choice) => {
                    const Icon = choice.icon;
                    return <button key={choice.type} type="button" onClick={() => setBlocks((current) => [...current, createEmptyBlock(choice.type, current.length + 1)])} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-3 py-3 text-xs font-bold"><Icon size={16} /> {choice.label}</button>;
                  })}
                </div>
              </section>

              <section className="space-y-3">
                {blocks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-8 text-center text-sm text-[var(--mikke-muted)]">ブロックはまだありません。</div>
                ) : blocks.map((block, index) => (
                  <BlockEditor
                    key={block.id}
                    block={block}
                    index={index}
                    total={blocks.length}
                    onChange={(update) => updateBlock(block.id, update)}
                    onMove={(direction) => moveBlock(index, direction)}
                    onDelete={() => setBlocks((current) => current.filter((item) => item.id !== block.id))}
                    cmsContent={cmsContent}
                  />
                ))}
              </section>
              {message ? <p role="status" className="rounded-xl bg-[var(--mikke-primary-soft)] px-4 py-3 text-sm font-bold text-[var(--mikke-accent)]">{message}</p> : null}
            </div>

            <aside className="xl:sticky xl:top-24 xl:self-start">
              <div className="rounded-3xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4 shadow-sm">
                <div className="flex items-center gap-2"><Eye size={17} className="text-[var(--mikke-accent)]" /><h2 className="text-sm font-bold">OS内プレビュー</h2></div>
                <p className="mt-1 text-xs text-[var(--mikke-muted)]">編集者だけが見る下書き表示です。</p>
                <div className="mt-4 min-h-80 overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
                  <PageBlockPreview blocks={blocks} cmsContent={cmsContent} />
                </div>
              </div>
            </aside>
          </div>
        </form>
      )}
    </MikkeAppShell>
  );
}

function BlockEditor({ block, index, total, onChange, onMove, onDelete, cmsContent }: { block: PageBlock; index: number; total: number; onChange: (update: (block: PageBlock) => PageBlock) => void; onMove: (direction: -1 | 1) => void; onDelete: () => void; cmsContent: Record<PageCmsSource, PageCmsItem[]> }) {
  const label = blockChoices.find((choice) => choice.type === block.type)?.label ?? "ブロック";
  return (
    <article className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--mikke-line-soft)] pb-3">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">{index + 1}. {label}</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="上へ" className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] disabled:opacity-30"><ArrowUp size={14} /></button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="下へ" className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] disabled:opacity-30"><ArrowDown size={14} /></button>
          <button type="button" onClick={onDelete} aria-label="削除" className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] text-[var(--mikke-danger)]"><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="mt-3"><BlockFields block={block} onChange={onChange} cmsContent={cmsContent} /></div>
    </article>
  );
}

function BlockFields({ block, onChange, cmsContent }: { block: PageBlock; onChange: (update: (block: PageBlock) => PageBlock) => void; cmsContent: Record<PageCmsSource, PageCmsItem[]> }) {
  if (block.type === "heading") return <div className="grid gap-3 sm:grid-cols-[120px_1fr]"><label className="block"><span className="text-xs font-bold">大きさ</span><select value={block.level} onChange={(event) => onChange((current) => current.type === "heading" ? { ...current, level: Number(event.target.value) as 1 | 2 | 3 } : current)} className={inputClass}><option value={1}>大</option><option value={2}>中</option><option value={3}>小</option></select></label><label className="block"><span className="text-xs font-bold">見出し</span><input value={block.text} onChange={(event) => onChange((current) => current.type === "heading" ? { ...current, text: event.target.value } : current)} className={inputClass} /></label></div>;
  if (block.type === "text") return <label className="block"><span className="text-xs font-bold">文章</span><textarea value={block.text} onChange={(event) => onChange((current) => current.type === "text" ? { ...current, text: event.target.value } : current)} rows={5} className={`${inputClass} resize-y`} /></label>;
  if (block.type === "image") return <div className="grid gap-3"><label className="block"><span className="text-xs font-bold">画像URL</span><input value={block.imageUrl} onChange={(event) => onChange((current) => current.type === "image" ? { ...current, imageUrl: event.target.value } : current)} className={inputClass} placeholder="https:// または /image.jpg" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="text-xs font-bold">代替テキスト</span><input value={block.alt} onChange={(event) => onChange((current) => current.type === "image" ? { ...current, alt: event.target.value } : current)} className={inputClass} /></label><label className="block"><span className="text-xs font-bold">キャプション</span><input value={block.caption ?? ""} onChange={(event) => onChange((current) => current.type === "image" ? { ...current, caption: event.target.value } : current)} className={inputClass} /></label></div></div>;
  if (block.type === "button") return <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="text-xs font-bold">ラベル</span><input value={block.label} onChange={(event) => onChange((current) => current.type === "button" ? { ...current, label: event.target.value } : current)} className={inputClass} /></label><label className="block"><span className="text-xs font-bold">リンク先</span><input value={block.href} onChange={(event) => onChange((current) => current.type === "button" ? { ...current, href: event.target.value } : current)} className={inputClass} placeholder="https:// または #section" /></label></div>;
  if (block.type === "form") return <div className="grid gap-3"><label className="block"><span className="text-xs font-bold">タイトル</span><input value={block.title} onChange={(event) => onChange((current) => current.type === "form" ? { ...current, title: event.target.value } : current)} className={inputClass} /></label><label className="block"><span className="text-xs font-bold">説明</span><textarea value={block.description} onChange={(event) => onChange((current) => current.type === "form" ? { ...current, description: event.target.value } : current)} rows={2} className={`${inputClass} resize-y`} /></label><label className="block"><span className="text-xs font-bold">ボタン表示</span><input value={block.buttonLabel} onChange={(event) => onChange((current) => current.type === "form" ? { ...current, buttonLabel: event.target.value } : current)} className={inputClass} /></label><p className="text-xs text-[var(--mikke-muted)]">送信処理はPG-5以降で設計します。</p></div>;
  if (block.type === "divider") return <p className="text-xs text-[var(--mikke-muted)]">横線で内容を区切ります。</p>;
  if (block.type === "cms") {
    const candidates = cmsContent[block.source];
    const selectedItemIds = block.filters.selectedItemIds ?? [];
    const sourceInfo = pageCmsSourceInfo[block.source];
    return <div className="grid gap-3"><label className="block"><span className="text-xs font-bold">見出し</span><input value={block.title} onChange={(event) => onChange((current) => current.type === "cms" ? { ...current, title: event.target.value } : current)} className={inputClass} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="text-xs font-bold">参照元</span><select value={block.source} onChange={(event) => onChange((current) => current.type === "cms" ? { ...current, source: event.target.value as PageCmsSource, filters: { ...current.filters, selectedItemIds: [] } } : current)} className={inputClass}>{Object.entries(cmsSourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block"><span className="text-xs font-bold">表示</span><select value={block.displayMode} onChange={(event) => onChange((current) => current.type === "cms" ? { ...current, displayMode: event.target.value as "list" | "cards" | "featured" } : current)} className={inputClass}><option value="list">リスト</option><option value="cards">カード</option><option value="featured">注目表示</option></select></label></div><dl className="grid gap-2 rounded-xl border border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] p-3 text-xs leading-5 sm:grid-cols-3"><div><dt className="font-bold text-[var(--mikke-accent)]">mikkeID接続</dt><dd className="mt-1 text-[var(--mikke-muted)]">{sourceInfo.connection}</dd></div><div><dt className="font-bold text-[var(--mikke-accent)]">表示できる内容</dt><dd className="mt-1 text-[var(--mikke-muted)]">{sourceInfo.visibleFields}</dd></div><div><dt className="font-bold text-[var(--mikke-accent)]">表示条件</dt><dd className="mt-1 text-[var(--mikke-muted)]">{sourceInfo.visibilityRule}</dd></div></dl><div className="flex flex-wrap gap-2"><label className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold"><input type="checkbox" checked={block.filters.thisMonthOnly ?? false} onChange={(event) => onChange((current) => current.type === "cms" ? { ...current, filters: { ...current.filters, thisMonthOnly: event.target.checked } } : current)} /> 今月のみ</label><label className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold"><input type="checkbox" checked={block.filters.approvedOnly ?? false} onChange={(event) => onChange((current) => current.type === "cms" ? { ...current, filters: { ...current.filters, approvedOnly: event.target.checked } } : current)} /> 承認済みのみ</label></div><fieldset className="rounded-xl border border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] p-3"><legend className="px-1 text-xs font-bold">表示する項目（未選択ならすべて）</legend>{candidates.length === 0 ? <p className="text-xs text-[var(--mikke-muted)]">選択できる公開候補はありません。</p> : <div className="grid gap-2 sm:grid-cols-2">{candidates.map((item) => <label key={item.id} className="flex items-start gap-2 rounded-lg bg-white p-2 text-xs"><input type="checkbox" checked={selectedItemIds.includes(item.id)} onChange={(event) => onChange((current) => { if (current.type !== "cms") return current; const selected = current.filters.selectedItemIds ?? []; return { ...current, filters: { ...current.filters, selectedItemIds: event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id) } }; })} className="mt-0.5" /><span><span className="block font-bold">{item.title}</span>{item.meta ? <span className="mt-0.5 block text-[var(--mikke-muted)]">{item.meta}</span> : null}</span></label>)}</div>}</fieldset><p className="text-xs leading-5 text-[var(--mikke-muted)]">Pageには選択IDと絞り込み条件だけを保存し、元データはコピーしません。Connect / Partnersのようなページも、このCMSブロックを組み合わせて構築します。</p></div>;
  }
  return null;
}

function PageBlockPreview({ blocks, cmsContent }: { blocks: PageBlock[]; cmsContent: Record<PageCmsSource, PageCmsItem[]> }) {
  if (blocks.length === 0) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">ブロックを追加すると、ここに表示されます。</p>;
  return <div className="space-y-5">{blocks.map((block) => {
    if (block.type === "heading") {
      const className = block.level === 1 ? "text-2xl" : block.level === 2 ? "text-xl" : "text-lg";
      return <h3 key={block.id} className={`${className} font-bold tracking-normal`}>{block.text || "見出し"}</h3>;
    }
    if (block.type === "text") return <p key={block.id} className="whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-text-soft)]">{block.text}</p>;
    if (block.type === "image") return <div key={block.id}>{block.imageUrl ? <img src={block.imageUrl} alt={block.alt} className="max-h-64 w-full rounded-xl object-cover" /> : <div className="grid h-36 place-items-center rounded-xl bg-[var(--mikke-surface-soft)] text-xs text-[var(--mikke-muted)]"><ImageIcon size={24} />画像URLを入力</div>}{block.caption ? <p className="mt-1 text-center text-xs text-[var(--mikke-muted)]">{block.caption}</p> : null}</div>;
    if (block.type === "button") return <span key={block.id} className="inline-flex rounded-lg bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white">{block.label || "ボタン"}</span>;
    if (block.type === "form") return <div key={block.id} className="rounded-2xl border border-[var(--mikke-line)] p-4"><p className="font-bold">{block.title}</p><p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{block.description}</p><div className="mt-3 h-10 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)]" /><button type="button" disabled className="mt-2 rounded-lg bg-[var(--mikke-primary)] px-4 py-2 text-xs font-bold text-white opacity-60">{block.buttonLabel}</button></div>;
    if (block.type === "divider") return <hr key={block.id} className="border-[var(--mikke-line)]" />;
    if (block.type === "cms") return <CmsBlockPreview key={block.id} block={block} items={cmsContent[block.source]} />;
    return null;
  })}</div>;
}

function CmsBlockPreview({ block, items }: { block: Extract<PageBlock, { type: "cms" }>; items: PageCmsItem[] }) {
  const selectedItemIds = block.filters.selectedItemIds ?? [];
  const currentMonth = new Date().toISOString().slice(0, 7);
  const filteredItems = items.filter((item) => {
    if (selectedItemIds.length > 0 && !selectedItemIds.includes(item.id)) return false;
    if (block.filters.thisMonthOnly && !item.occurredAt.startsWith(currentMonth)) return false;
    if (block.filters.approvedOnly && !item.approved) return false;
    return true;
  });
  const visibleItems = block.displayMode === "featured" ? filteredItems.slice(0, 1) : filteredItems.slice(0, 6);
  return (
    <section>
      <div className="flex items-center justify-between gap-2"><h3 className="text-lg font-bold tracking-normal">{block.title || cmsSourceLabels[block.source]}</h3><span className="text-[10px] font-bold text-[var(--mikke-muted)]">{cmsSourceLabels[block.source]}</span></div>
      {visibleItems.length === 0 ? <p className="mt-3 rounded-xl bg-[var(--mikke-surface-soft)] p-4 text-xs text-[var(--mikke-muted)]">公開中の表示候補はありません。</p> : (
        <div className={block.displayMode === "list" ? "mt-3 space-y-2" : "mt-3 grid gap-3 sm:grid-cols-2"}>
          {visibleItems.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-xl border border-[var(--mikke-line-soft)] bg-white">
              {item.imageUrl && block.displayMode !== "list" ? <img src={item.imageUrl} alt="" className="h-28 w-full object-cover" /> : null}
              <div className="p-3"><p className="text-sm font-bold">{item.title}</p>{item.summary ? <p className="mt-1 line-clamp-3 text-xs leading-5 text-[var(--mikke-muted)]">{item.summary}</p> : null}{item.meta ? <p className="mt-2 text-[10px] font-bold text-[var(--mikke-accent)]">{item.meta}</p> : null}{item.href ? <a href={item.href} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[10px] font-bold text-[var(--mikke-primary)]">リンクを開く</a> : null}</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
