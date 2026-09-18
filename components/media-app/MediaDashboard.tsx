"use client";
import { MediaCloudAnalytics } from "./MediaCloudSocial";
import { useMediaRepository } from "./MediaRepository";
import { mediaLoadError } from "@/lib/media-app/load-error";

import { MediaLink as Link, useMediaReviewNavigation } from "./MediaNavigation";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, ExternalLink, PenLine, Plus } from "lucide-react";
import { useAuth } from "@/components/AuthGate";

import type { MediaArticle, MediaSite } from "@/lib/media-app/types";

export function MediaDashboard() {
  const { profile } = useAuth();
  const repository = useMediaRepository();
  const { getOwnedMedia, listMediaArticles } = repository;
  const [loadError,setLoadError] = useState<ReturnType<typeof mediaLoadError>|null>(null);
  const [loadAttempt,setLoadAttempt] = useState(0);
  const [loading,setLoading]=useState(true);
  const { reviewing } = useMediaReviewNavigation();
  const [site, setSite] = useState<MediaSite | null>(null);
  const [articles, setArticles] = useState<MediaArticle[]>([]);
  useEffect(() => { let alive=true; setLoading(true); setSite(null); setArticles([]); setLoadError(null); void (async()=>{try {const next=await getOwnedMedia(profile.id); const items=next?await listMediaArticles(next.id):[]; if(alive){setSite(next);setArticles(items);}} catch(cause) {if(alive)setLoadError(mediaLoadError(cause));}finally{if(alive)setLoading(false);}})(); return()=>{alive=false;}; },[profile.id,repository,getOwnedMedia,listMediaArticles,loadAttempt]);
  if(site && site.ownerProfileId !== (repository.cloud?profile.user_id:profile.id)) return <p>記事を読み込んでいます…</p>;
  if(loading) return <p>記事を読み込んでいます…</p>;
  if(loadError) return <section role="alert" className="rounded-xl border border-[var(--mikke-line)] bg-white p-4"><p>{loadError.message}</p><p className="mt-2 text-xs text-[var(--mikke-muted)]">確認コード：MEDIA-{loadError.code}</p><button type="button" onClick={()=>setLoadAttempt(value=>value+1)} className="mt-4 rounded-xl bg-[var(--mikke-primary)] px-4 py-3 font-semibold text-white">もう一度読み込む</button></section>;
  if (!site) return <section className="mx-auto grid min-h-[62vh] max-w-2xl place-items-center text-center"><div><span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]"><BookOpen size={30} /></span><p className="mt-6 text-xs font-black tracking-[0.14em] text-[var(--mikke-primary)]">MEDIA FREE</p><h1 className="mt-2 text-3xl font-black">発信を、ここから残していく。</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[var(--mikke-muted)]">難しい設定なしで、記事を書き、確認して、自分のMediaに公開できます。</p><Link href="/apps/media/new" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[var(--mikke-primary)] px-5 py-3 text-sm font-bold text-white"><Plus size={17} />Mediaを作る</Link></div></section>;
  const drafts = articles.filter((article) => article.status !== "published" || (article.publishedSnapshot && article.updatedAt > article.publishedSnapshot.updatedAt));
  const published = articles.filter((article) => article.publishedSnapshot);
  return <div className="space-y-5"><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black tracking-[0.14em] text-[var(--mikke-primary)]">ホーム</p><h1 className="mt-2 text-3xl font-black">{site.name}</h1><p className="mt-2 text-sm text-[var(--mikke-muted)]">今日は何を書きますか？</p></div><Link href="/apps/media/write" className="inline-flex items-center gap-2 rounded-xl bg-[var(--mikke-orange)] px-4 py-3 text-sm font-bold text-white"><PenLine size={16} />記事を書く</Link></header><section className="grid grid-cols-3 gap-2 sm:gap-4">{[{label:"記事",count:articles.length,filter:"all"},{label:"書きかけ",count:drafts.length,filter:"draft"},{label:"公開中",count:published.length,filter:"published"}].map((item,index)=><Link style={{backgroundColor:"white",borderTop:`3px solid ${["var(--mikke-green)","var(--mikke-yellow)","var(--mikke-pink)"][index]}`}} key={item.filter} href={`/apps/media/articles?filter=${item.filter}`} className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-primary-soft)] p-3 sm:p-5 transition-colors hover:bg-[var(--mikke-primary-soft)]"><p className="text-xs font-bold text-[var(--mikke-muted)]">{item.label}</p><p style={{lineHeight:1.2}} className="mt-1 text-2xl font-black text-[var(--mikke-primary)] sm:text-3xl">{item.count}</p></Link>)}</section><section data-home-next className="rounded-3xl border border-[var(--mikke-line)] bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black">次にすること</h2><p className="mt-1 text-sm text-[var(--mikke-muted)]">{drafts[0] ? "書きかけの記事を続けましょう。" : "新しい記事を1本書いてみましょう。"}</p></div>{drafts[0] ? <Link href={`/apps/media/write?article=${drafts[0].id}`} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-bold text-[var(--mikke-primary)]">続きを書く<ArrowRight size={15} /></Link> : <Link href="/apps/media/write" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-bold text-[var(--mikke-primary)]">書き始める<ArrowRight size={15} /></Link>}</div>{drafts[0] ? <div className="mt-5 border-t border-[var(--mikke-line-soft)] pt-4"><p className="font-bold">{drafts[0].title || "無題の記事"}</p><p className="mt-1 text-xs text-[var(--mikke-muted)]">最終保存 {new Date(drafts[0].updatedAt).toLocaleString("ja-JP")}</p></div> : null}</section>{repository.cloud?<MediaCloudAnalytics siteId={site.id}/>:null}<section data-home-reader className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--mikke-primary-soft)] p-4"><div><p className="font-bold">公開ページを確認</p><p className="mt-1 text-xs text-[var(--mikke-muted)]">{reviewing ? "このブラウザで公開版を保存した記事を表示します。" : "公開済みの記事だけが読者に表示されます。"}</p></div><Link href={reviewing ? "/media/mikkeos-media-preview" : `/media/${site.slug}`} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[var(--mikke-primary)]"><ExternalLink size={15} />Mediaを見る</Link></section></div>;
}
