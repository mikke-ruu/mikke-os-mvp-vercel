"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, FileText, Globe2, Pencil, Plus, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import {
  createPageDocument,
  deletePageDocument,
  getPageSite,
  movePageDocument,
  normalizePageSiteSlug
} from "@/lib/page/store";
import type { PageDocumentMode, PageSite } from "@/lib/page/types";
import type { PageStarterTemplateId } from "@/lib/page/templates";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";

export function PageSiteEditor() {
  const params = useParams<{ siteId: string }>();
  const [site, setSite] = useState<PageSite | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [mode, setMode] = useState<PageDocumentMode>("builder");
  const [templateId, setTemplateId] = useState<PageStarterTemplateId>("blank");
  const [message, setMessage] = useState("");

  function refresh() {
    setSite(getPageSite(params.siteId));
  }

  useEffect(() => {
    setSite(getPageSite(params.siteId));
    setLoaded(true);
  }, [params.siteId]);

  function addDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      createPageDocument(params.siteId, { title, slug, mode, templateId });
      setTitle("");
      setSlug("");
      refresh();
      setMessage("ページを追加しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ページを追加できませんでした。");
    }
  }

  function removeDocument(pageId: string, pageTitle: string) {
    if (!window.confirm(`「${pageTitle}」を削除しますか？`)) return;
    setMessage("");
    try {
      deletePageDocument(params.siteId, pageId);
      refresh();
      setMessage("ページを削除しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ページを削除できませんでした。");
    }
  }

  function moveDocument(pageId: string, direction: -1 | 1) {
    movePageDocument(params.siteId, pageId, direction);
    refresh();
  }

  return (
    <MikkeAppShell
      appName="Page"
      title={site?.name ?? "Pageを編集"}
      subtitle="ページを追加し、表示順を整えます。"
      currentApp={{ label: "Page", href: "/apps/page" }}
    >
      {!loaded ? (
        <p className="text-sm text-[var(--mikke-muted)]">Pageを読み込んでいます。</p>
      ) : !site ? (
        <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
          <p className="text-sm text-[var(--mikke-muted)]">このPageは見つかりませんでした。</p>
          <Link href="/apps/page" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--mikke-accent)]">
            <ArrowLeft size={16} /> Page一覧へ戻る
          </Link>
        </section>
      ) : (
        <>
          <section className="rounded-3xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="mt-1 text-xl font-bold tracking-normal">ページ一覧</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">
                  /{site.publication.slug} の下書き構成です。外部公開はまだ行いません。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/apps/page/${site.id}/preview`} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-muted)]">
                  <Globe2 size={15} /> サイトを表示
                </Link>
                <Link href="/apps/page" className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">
                  <ArrowLeft size={15} /> 一覧へ戻る
                </Link>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {site.documents.map((document, index) => (
                <article key={document.id} className="rounded-2xl border border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--mikke-accent)]">
                        <FileText size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{index + 1}. {document.title}</p>
                        <p className="mt-1 text-xs text-[var(--mikke-muted)]">slug: {document.slug} / {document.mode === "html" ? "AI HTMLページ" : `${document.blocks.length}ブロック`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveDocument(document.id, -1)} disabled={index === 0} aria-label={`${document.title}を上へ`} className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white disabled:opacity-30"><ArrowUp size={15} /></button>
                      <button type="button" onClick={() => moveDocument(document.id, 1)} disabled={index === site.documents.length - 1} aria-label={`${document.title}を下へ`} className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white disabled:opacity-30"><ArrowDown size={15} /></button>
                      <Link href={`/apps/page/${site.id}/${document.id}`} aria-label={`${document.title}を編集`} className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--mikke-primary)] text-white"><Pencil size={15} /></Link>
                      <button type="button" onClick={() => removeDocument(document.id, document.title)} disabled={site.documents.length <= 1} aria-label={`${document.title}を削除`} className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--mikke-danger)] disabled:opacity-30"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <form onSubmit={addDocument} className="mt-6 rounded-2xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Plus size={18} className="text-[var(--mikke-accent)]" />
              <h2 className="text-lg font-bold tracking-normal">ページを追加</h2>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold">ページ名 *</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="例: お問い合わせ" maxLength={80} required />
              </label>
              <label className="block">
                <span className="text-xs font-bold">ページslug *</span>
                <input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").replace(/^-/, ""))} onBlur={() => setSlug((current) => normalizePageSiteSlug(current))} className={inputClass} placeholder="contact" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} required />
              </label>
              <label className="block">
                <span className="text-xs font-bold">ページ形式</span>
                <select value={mode} onChange={(event) => setMode(event.target.value as PageDocumentMode)} className={inputClass}><option value="builder">かんたんビルダー</option><option value="html">AI HTMLページ</option></select>
              </label>
              {mode === "builder" ? <label className="block">
                <span className="text-xs font-bold">テンプレート</span>
                <select value={templateId} onChange={(event) => setTemplateId(event.target.value as PageStarterTemplateId)} className={inputClass}><option value="blank">白紙</option><option value="company">会社・団体</option><option value="service">サービス</option><option value="portfolio">作品・実績</option><option value="connect-partners">Connect / Partners</option></select>
              </label> : null}
            </div>
            {message ? <p role="status" className="mt-4 text-sm font-bold text-[var(--mikke-accent)]">{message}</p> : null}
            <div className="mt-4 flex justify-end">
              <button type="submit" disabled={!title.trim() || !slug} className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"><Plus size={16} /> ページを追加</button>
            </div>
          </form>
        </>
      )}
    </MikkeAppShell>
  );
}
