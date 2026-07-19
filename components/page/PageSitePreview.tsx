"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Laptop, Link2, Pencil, Smartphone, Tablet, X } from "lucide-react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { PageDeviceFrame, type PageViewportDevice, type PageZoomMode } from "./PageDeviceFrame";
import { PageRenderer } from "./PageRenderer";
import { usePageCmsContent } from "@/lib/page/cms-selectors";
import { collectSiteLinkIssues, pageLinkIssueLabels } from "@/lib/page/links";
import { getPageSite } from "@/lib/page/store";
import type { PageSite } from "@/lib/page/types";

export function PageSitePreview() {
  const params = useParams<{ siteId: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [site, setSite] = useState<PageSite | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [device, setDevice] = useState<PageViewportDevice>("desktop");
  const [zoomMode] = useState<PageZoomMode>("auto");
  const [linkPanelOpen, setLinkPanelOpen] = useState(false);
  const cmsContent = usePageCmsContent(site?.ownerProfileId);

  useEffect(() => {
    const nextSite = getPageSite(params.siteId);
    setSite(nextSite);
    const requestedSlug = searchParams.get("page");
    const requested = requestedSlug ? nextSite?.documents.find((document) => document.slug === requestedSlug) : undefined;
    setActiveDocumentId(requested?.id ?? nextSite?.documents[0]?.id ?? null);
    setLoaded(true);
    // 初期表示のみ。以降のslug変更はページ内ナビ操作(navigateToDocument)で行う
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.siteId]);

  const activeDocument = useMemo(() => site?.documents.find((document) => document.id === activeDocumentId) ?? null, [site, activeDocumentId]);
  const issues = useMemo(() => (site ? collectSiteLinkIssues(site) : []), [site]);

  function hasNavigableHistory() {
    try {
      return typeof window !== "undefined" && window.history.length > 1;
    } catch {
      return false;
    }
  }

  function goBackToEditor() {
    if (hasNavigableHistory()) {
      router.back();
      return;
    }
    if (site) router.push(`/apps/page/${site.id}`);
  }

  function navigateToDocument(documentId: string) {
    if (!site) return;
    const target = site.documents.find((document) => document.id === documentId);
    if (!target) return;
    setActiveDocumentId(documentId);
    router.replace(`${pathname}?page=${target.slug}`, { scroll: false });
  }

  function handlePreviewClick(event: MouseEvent<HTMLDivElement>) {
    if (!site) return;
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href") || "";
    const normalized = href.replace(/^\/+|\/+$/g, "").toLowerCase();
    const match = site.documents.find((document) => document.slug.toLowerCase() === normalized);
    if (!match) return;
    event.preventDefault();
    navigateToDocument(match.id);
  }

  if (!loaded) return <MikkeAppShell appName="Page" title="サイトプレビュー" subtitle="読み込み中" currentApp={{ label: "Page", href: "/apps/page" }}><p className="text-sm text-[var(--mikke-muted)]">読み込んでいます。</p></MikkeAppShell>;
  if (!site) return <MikkeAppShell appName="Page" title="サイトプレビュー" subtitle="サイトが見つかりません" currentApp={{ label: "Page", href: "/apps/page" }}><section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5"><p className="text-sm text-[var(--mikke-muted)]">このサイトは見つかりませんでした。</p><Link href="/apps/page" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--mikke-accent)]"><ArrowLeft size={16} /> Page一覧へ戻る</Link></section></MikkeAppShell>;

  return (
    <MikkeAppShell appName="Page" title={`${site.name}のプレビュー`} subtitle="サイト全体をブラウザに近い見た目で確認できます" currentApp={{ label: "Page", href: "/apps/page" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={goBackToEditor} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold"><ArrowLeft size={15} /> 編集に戻る</button>
        {activeDocument ? <Link href={`/apps/page/${site.id}/${activeDocument.id}`} className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white"><Pencil size={14} /> このページを編集</Link> : null}
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mikke-line-soft)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-[var(--mikke-accent)]">SITE PREVIEW</p>
            <h2 className="truncate text-sm font-bold">{site.name}</h2>
          </div>
          <nav className="flex flex-wrap items-center gap-1.5" aria-label="ページ切替">
            {site.documents.map((document) => (
              <button
                key={document.id}
                type="button"
                onClick={() => navigateToDocument(document.id)}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition ${document.id === activeDocumentId ? "bg-[var(--mikke-primary)] text-white" : "border border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)] hover:border-[var(--mikke-accent)]"}`}
              >
                {document.title}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <DeviceButton active={device === "desktop"} label="PC" onClick={() => setDevice("desktop")} icon={<Laptop size={14} />} />
            <DeviceButton active={device === "tablet"} label="タブレット" onClick={() => setDevice("tablet")} icon={<Tablet size={14} />} />
            <DeviceButton active={device === "mobile"} label="スマホ" onClick={() => setDevice("mobile")} icon={<Smartphone size={14} />} />
            <button
              type="button"
              onClick={() => setLinkPanelOpen((current) => !current)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${linkPanelOpen ? "bg-[var(--mikke-primary)] text-white" : "border border-[var(--mikke-line)] bg-white"}`}
            >
              <Link2 size={14} /> リンクチェック
              {issues.length ? <span className={`ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] ${linkPanelOpen ? "bg-white text-[var(--mikke-primary)]" : "bg-[var(--mikke-danger)] text-white"}`}>{issues.length}</span> : null}
            </button>
          </div>
        </div>

        <div className={`grid gap-0 ${linkPanelOpen ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "lg:grid-cols-1"}`}>
          <div className="min-w-0 overflow-auto bg-[var(--mikke-surface-soft)] p-3 sm:p-6" onClickCapture={handlePreviewClick}>
            {activeDocument ? (
              <PageDeviceFrame device={device} zoomMode={zoomMode} mode="content">
                <div className="overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/5">
                  <PageRenderer document={activeDocument} theme={site.theme} cmsContent={cmsContent} viewport={device} sitePages={site.documents.map((item) => ({ id: item.id, title: item.title, slug: item.slug }))} activeDocumentId={activeDocument.id} />
                </div>
              </PageDeviceFrame>
            ) : (
              <p className="py-20 text-center text-sm text-[var(--mikke-muted)]">表示できるページがありません。</p>
            )}
          </div>

          {linkPanelOpen ? (
            <aside className="border-t border-[var(--mikke-line-soft)] bg-white p-4 lg:border-l lg:border-t-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold">リンクチェック</h3>
                <button type="button" onClick={() => setLinkPanelOpen(false)} aria-label="閉じる" className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] lg:hidden"><X size={14} /></button>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-[var(--mikke-muted)]">サイト内の全ページのリンクを確認します（実際のアクセスはしません）。</p>
              {issues.length === 0 ? (
                <p className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] p-4 text-xs leading-5 text-[var(--mikke-muted)]">気になるリンクは見つかりませんでした。</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {issues.map((issue) => (
                    <li key={issue.id} className="rounded-xl border border-[var(--mikke-line-soft)] p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--mikke-danger)]" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-[var(--mikke-danger)]">{pageLinkIssueLabels[issue.issue]}</p>
                          <p className="mt-0.5 truncate text-xs font-bold">{issue.documentTitle} / {issue.blockLabel}</p>
                          <p className="mt-0.5 break-all text-[11px] text-[var(--mikke-muted)]">{issue.fieldLabel}: {issue.value || "（空）"}</p>
                          <Link href={`/apps/page/${site.id}/${issue.documentId}`} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--mikke-primary)]">このページを編集 →</Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          ) : null}
        </div>
      </section>
    </MikkeAppShell>
  );
}

function DeviceButton({ active, label, onClick, icon }: { active: boolean; label: string; onClick: () => void; icon: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-label={label} className={`grid h-8 w-8 place-items-center rounded-lg border ${active ? "border-[var(--mikke-primary)] bg-[var(--mikke-primary)] text-white" : "border-[var(--mikke-line)] bg-white"}`}>{icon}</button>;
}
