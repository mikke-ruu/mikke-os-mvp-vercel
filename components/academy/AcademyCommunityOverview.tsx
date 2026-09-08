"use client";
import { useState } from "react";
import Link from "next/link";
import type { AcademyCommunityLinkOption } from "@/lib/academy/community-links";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";

const samplePeople = [
  { name: "サンプル先生A", state: "未招待" },
  { name: "サンプル先生B", state: "招待中" },
  { name: "サンプル先生C", state: "参加済み" }
];
export function AcademyCommunityOverview({ sample, links, unavailable }: { sample: boolean; links: AcademyCommunityLinkOption[]; unavailable: boolean }) {
  const [filter, setFilter] = useState("すべて");
  const preview = process.env.NODE_ENV === "development" && sample;
  return <section className="rounded-lg border border-[var(--mikke-line)] bg-white p-4" aria-label="Communityの利用と招待">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-bold">Communityの利用と招待</h2><span className="rounded-md border border-[#8bc7ad] px-2 py-1 text-xs">{preview ? "契約中（見本）" : "契約情報はCommunityで確認"}</span></div>
    <p className="mt-2 text-sm leading-6">本部のお知らせや先生同士の相談に使います。Academyの講師登録とCommunityへの参加は別です。</p>
    {preview ? <>
      <p className="mt-2 text-xs leading-5">一覧と人数は表示確認用の架空データです。実際の契約・講師・招待状況ではありません。</p>
      <dl className="my-3 grid grid-cols-3 divide-x divide-[var(--mikke-line)] text-center text-sm"><div><dt>利用者</dt><dd className="font-bold">1名</dd></div><div><dt>未招待</dt><dd className="font-bold">1名</dd></div><div><dt>招待中</dt><dd className="font-bold">1名</dd></div></dl>
      <label className="flex flex-wrap items-center gap-2 text-sm">参加状態で絞り込み<select aria-label="Community参加状態" value={filter} onChange={event=>setFilter(event.target.value)} className="min-h-11 rounded-md border border-[var(--mikke-line)] bg-white px-3">{["すべて", "未招待", "招待中", "参加済み"].map(value=><option key={value}>{value}</option>)}</select></label>
      <ul className="mt-2 divide-y divide-[var(--mikke-line)]">{samplePeople.filter(p=>filter === "すべて" || p.state === filter).map(p=><li key={p.name} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{p.name}</span><span className="rounded-md border border-[var(--mikke-line)] px-2 py-1 text-xs">{p.state}</span></li>)}</ul>
      <Link className="mt-2 inline-flex min-h-11 items-center text-sm text-[var(--mikke-primary)]" href={`/academy/flow-review?tab=community&from=${encodeURIComponent(toCurrentAcademyContextHref("/academy/settings?preview=walkthrough"))}`}>招待して参加する流れを見る →</Link>
    </> : <>
      {unavailable ? <p role="status" className="mt-3 text-sm">連携情報を取得できませんでした。未契約や0名という意味ではありません。</p> : links.length ? <ul className="mt-3 space-y-2">{links.map(link => <li key={link.communityId} className="border-t border-[var(--mikke-line)] pt-2 text-sm"><strong>{link.communityName}</strong><p className="mt-1">{link.mappings.some(m=>m.isCurrent && m.status === "active") ? "Academyとの連携あり" : "有効な連携なし"}</p></li>)}</ul> : <p className="mt-3 text-sm">このアカウントで確認できる接続候補はありません。Communityの未契約を意味するものではありません。</p>}
      <p className="mt-2 text-xs leading-6">契約状況・利用者数・先生ごとの招待状態の取得はまだ接続されていません。未確認の方を「未招待」とは表示しません。</p>
    </>}
  </section>;
}
