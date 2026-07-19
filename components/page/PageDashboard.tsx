"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, Eye, Globe2, LayoutTemplate, Plus, Sparkles } from "lucide-react";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { PageDeviceFrame } from "./PageDeviceFrame";
import { PageRenderer } from "./PageRenderer";
import { PageTemplatePreview } from "./PageTemplatePreview";
import { emptyPageCmsContent } from "@/lib/page/cms-selectors";
import { pageDemoState } from "@/lib/page/demo";
import { listPageSites } from "@/lib/page/store";
import type { PageStarterTemplateId } from "@/lib/page/templates";
import type { PageSite } from "@/lib/page/types";

const templates: { id: PageStarterTemplateId; label: string; helper: string }[] = [
  { id: "company", label: "会社・団体", helper: "紹介・会社概要・お問い合わせ" },
  { id: "service", label: "サービス", helper: "特徴・CMS・申込み導線" },
  { id: "portfolio", label: "作品・実績", helper: "写真を中心に魅せる" },
  { id: "connect-partners", label: "CMSポータル", helper: "mikkeIDの活動をまとめる" },
  { id: "blank", label: "白紙から", helper: "自由に組み立てる" }
];

export function PageDashboard() {
  const [sites, setSites] = useState<PageSite[]>(pageDemoState.sites);

  useEffect(() => {
    setSites(listPageSites());
  }, []);

  const documentCount = sites.reduce((total, site) => total + site.documents.length, 0);

  return (
    <MikkeAppShell
      appName="Page"
      title="Page"
      subtitle="AIの速さと、ノーコード編集の分かりやすさをひとつに。"
      currentApp={{ label: "Page", href: "/apps/page" }}
    >
      <section className="relative overflow-hidden rounded-[28px] border border-[var(--mikke-line)] bg-gradient-to-br from-[var(--mikke-primary-soft)] via-white to-[var(--mikke-accent-soft)] px-5 py-7 shadow-sm sm:px-8 sm:py-9">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_300px] lg:items-center">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[var(--mikke-primary)] shadow-sm"><Sparkles size={14} /> かんたんホームページ作成</p>
            <h2 className="mt-4 text-2xl font-extrabold leading-tight tracking-normal text-[var(--mikke-text)] sm:text-4xl">選んで、触って、あなたらしく。</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--mikke-muted)] sm:text-base">テンプレートから始めても、AIが作ったHTMLから始めても大丈夫。あとから必要な場所だけ、見たまま編集できます。</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/apps/page/new" className="inline-flex items-center gap-2 rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white shadow-sm"><Plus size={17} /> 新しいサイトを作る</Link>
              {sites[0] ? <Link href={`/apps/page/${sites[0].id}`} className="inline-flex items-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-3 text-sm font-bold text-[var(--mikke-primary)]">編集を続ける <ArrowRight size={16} /></Link> : null}
            </div>
          </div>
          <div className="hidden overflow-hidden rounded-2xl border border-white shadow-lg lg:block">
            <PageTemplatePreview templateId="company" />
          </div>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[var(--mikke-accent-soft)] opacity-70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-52 w-52 rounded-full bg-[var(--mikke-primary-soft)] opacity-70 blur-3xl" />
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold text-[var(--mikke-accent)]">START WITH A DESIGN</p><h2 className="mt-1 text-xl font-bold tracking-normal sm:text-2xl">イメージに近い形から始める</h2><p className="mt-2 text-sm text-[var(--mikke-muted)]">内容・色・並び順は、作成後にいつでも変更できます。</p></div>
          <Link href="/apps/page/new" className="inline-flex items-center gap-1 text-sm font-bold text-[var(--mikke-primary)]">すべて見て作る <ArrowRight size={16} /></Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {templates.map((template) => (
            <Link key={template.id} href={`/apps/page/new?template=${template.id}`} className="group rounded-2xl border border-[var(--mikke-line)] bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:border-[var(--mikke-primary-border)] hover:shadow-md">
              <PageTemplatePreview templateId={template.id} />
              <h3 className="mt-3 text-sm font-bold group-hover:text-[var(--mikke-primary)]">{template.label}</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{template.helper}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-9">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold text-[var(--mikke-accent)]">YOUR SITES</p><h2 className="mt-1 text-xl font-bold tracking-normal sm:text-2xl">最近のサイト</h2></div>
          <div className="flex items-center gap-4 text-xs font-bold text-[var(--mikke-muted)]"><span>{sites.length}サイト</span><span>{documentCount}ページ</span></div>
        </div>
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sites.map((site) => {
            const firstPage = site.documents[0];
            return (
              <article key={site.id} className="overflow-hidden rounded-3xl border border-[var(--mikke-line)] bg-white shadow-sm">
                <div className="relative aspect-[16/9] overflow-hidden" style={{ backgroundColor: site.theme.backgroundColor }}>
                  {firstPage ? (
                    <PageDeviceFrame device="desktop" zoomMode="auto" mode="crop" className="pointer-events-none">
                      <PageRenderer document={{ mode: firstPage.mode, blocks: firstPage.blocks, htmlDocument: firstPage.htmlDocument }} theme={site.theme} cmsContent={emptyPageCmsContent} compact decorative />
                    </PageDeviceFrame>
                  ) : (
                    <div className="grid h-full place-items-center bg-gradient-to-br from-[var(--mikke-surface-soft)] to-white">
                      <span className="text-sm font-bold text-[var(--mikke-muted)]">{site.name}</span>
                    </div>
                  )}
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[var(--mikke-accent)] shadow-sm">下書き</span>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{site.name}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--mikke-muted)]">{site.description || "サイトの説明はまだありません。"}</p></div><span className="shrink-0 rounded-full bg-[var(--mikke-surface-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--mikke-muted)]">/{site.publication.slug}</span></div>
                  <div className="mt-4 flex items-center justify-between border-t border-[var(--mikke-line-soft)] pt-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--mikke-muted)]"><Clock3 size={13} /> {firstPage ? `${site.documents.length}ページ` : "ページなし"}</span>
                    <div className="flex items-center gap-2">
                      <Link href={`/apps/page/${site.id}/preview`} aria-label={`${site.name}をプレビュー`} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-muted)]"><Eye size={14} /> 見る</Link>
                      <Link href={`/apps/page/${site.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white">編集する <ArrowRight size={14} /></Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          <Link href="/apps/page/new" className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-[var(--mikke-primary-border)] bg-[var(--mikke-primary-soft)] p-6 text-center transition hover:border-[var(--mikke-accent)]"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-[var(--mikke-accent)] shadow-sm"><Plus size={22} /></span><p className="mt-4 font-bold">新しいサイトを作る</p><p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">テンプレート選びから約3分で下書きを始められます。</p></div></Link>
        </div>
      </section>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--mikke-line)] bg-white px-5 py-4">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]"><Globe2 size={19} /></span><div><h2 className="text-sm font-bold">現在は下書きとOS内プレビューに対応</h2><p className="mt-1 text-xs text-[var(--mikke-muted)]">外部公開・決済・独自ドメインは後続フェーズです。</p></div></div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--mikke-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--mikke-muted)]"><LayoutTemplate size={14} /> デザインはいつでも変更可能</span>
      </section>
    </MikkeAppShell>
  );
}
