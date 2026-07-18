"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Globe2, Layers3, Plus } from "lucide-react";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { MetricCard } from "@/components/mikkeos/MetricCard";
import { pageDemoState } from "@/lib/page/demo";
import { listPageSites } from "@/lib/page/store";
import type { PageSite } from "@/lib/page/types";

export function PageDashboard() {
  const [sites, setSites] = useState<PageSite[]>(pageDemoState.sites);

  useEffect(() => {
    setSites(listPageSites());
  }, []);

  const documentCount = sites.reduce((total, site) => total + site.documents.length, 0);
  const blockCount = sites.reduce(
    (total, site) => total + site.documents.reduce((pageTotal, page) => pageTotal + page.blocks.length, 0),
    0
  );

  return (
    <MikkeAppShell
      appName="Page"
      title="Page"
      subtitle="会社・団体・ブランドのページを作り、既存アプリの活動を束ねて見せる場所です。"
      currentApp={{ label: "Page", href: "/apps/page" }}
    >
      <section className="grid grid-cols-3 gap-3">
        <MetricCard label="サイト" value={`${sites.length}件`} helper="localStorageの下書き" />
        <MetricCard label="ページ" value={`${documentCount}件`} helper="ホーム・概要など" tone="green" />
        <MetricCard label="ブロック" value={`${blockCount}個`} helper="積み上げ式" tone="navy" />
      </section>

      <section className="mt-6 rounded-3xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]">
            <Globe2 size={22} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mikke-accent)]">PG-1-a</p>
            <h2 className="mt-1 text-xl font-bold tracking-normal">Page入口</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--mikke-muted)]">
              ここではPageの下書き構成だけを確認します。公開、独自ドメイン、他者掲載依頼、決済、フォーム送信はまだ行いません。
            </p>
          </div>
        </div>
      </section>

      <div className="mt-6 flex justify-end">
        <Link
          href="/apps/page/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white"
        >
          <Plus size={17} /> 新しいPageを作る
        </Link>
      </div>

      <section className="mt-6 grid gap-4">
        {sites.map((site) => (
          <article key={site.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[var(--mikke-accent)]">下書き</p>
                <h2 className="mt-1 text-xl font-bold tracking-normal">{site.name}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">{site.description}</p>
              </div>
              <span className="rounded-full bg-[var(--mikke-surface-soft)] px-3 py-1 text-xs font-bold text-[var(--mikke-muted)]">
                /{site.publication.slug}
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {site.documents.map((page) => (
                <div key={page.id} className="rounded-2xl border border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] p-4">
                  <div className="flex items-center gap-2">
                    <FileText size={17} className="text-[var(--mikke-accent)]" />
                    <p className="text-sm font-bold text-[var(--mikke-text)]">{page.title}</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">
                    {page.blocks.length}ブロック / slug: {page.slug}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Link href={`/apps/page/${site.id}`} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]">
                ページを管理する <ArrowRight size={15} />
              </Link>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-dashed border-[var(--mikke-primary-border)] bg-[var(--mikke-primary-soft)] p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[var(--mikke-accent)]">
            <Layers3 size={20} />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-normal">次に作るところ</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">
              PG-1-dで、見出し・文章・画像・ボタン・区切りの積み上げ式編集を追加します。
            </p>
            <Link href="/manager" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[var(--mikke-accent)]">
              Managerで他アプリの動きを見る <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>
    </MikkeAppShell>
  );
}
