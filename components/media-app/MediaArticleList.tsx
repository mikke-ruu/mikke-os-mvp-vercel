"use client";
import { useSearchParams } from "next/navigation";
import styles from "./MediaArticleList.module.css";
import { useMediaRepository } from "./MediaRepository";

import { MediaLink as Link } from "./MediaNavigation";
import { useEffect, useState } from "react";
import { ArrowRight, FileText, PenLine } from "lucide-react";
import { useAuth } from "@/components/AuthGate";

import type { MediaArticle, MediaSite } from "@/lib/media-app/types";

export function MediaArticleList() {
  const { profile } = useAuth();
  const filter = useSearchParams().get("filter") ?? "all";
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("");
  const [month,setMonth]=useState("");
  const [page,setPage]=useState(1);
  useEffect(()=>setPage(1),[query,category,month,filter]);
  const repository = useMediaRepository();
  const { getOwnedMedia, listMediaArticles } = repository;
  const [loadError,setLoadError] = useState("");
  const [loading,setLoading]=useState(true);
  const [site, setSite] = useState<MediaSite | null>(null);
  const [items, setItems] = useState<MediaArticle[]>([]);
  useEffect(() => { let alive=true; setLoading(true); setSite(null); setItems([]); setLoadError(""); void (async()=>{try {const next=await getOwnedMedia(profile.id); const items=next?await listMediaArticles(next.id):[]; if(alive){setSite(next);setItems(items);}} catch {if(alive)setLoadError("記事を読み込めませんでした。ログインと接続を確認してください。");}finally{if(alive)setLoading(false);}})(); return()=>{alive=false;}; },[profile.id,repository,getOwnedMedia,listMediaArticles]);
  if(site && site.ownerProfileId !== (repository.cloud?profile.user_id:profile.id)) return <p>記事を読み込んでいます…</p>;
  if(loading) return <p>記事を読み込んでいます…</p>;
  if(loadError) return <p role="alert">{loadError}</p>;
  if (!site) return <div className="rounded-2xl border border-dashed border-[var(--mikke-line)] p-8 text-center"><p className="font-bold">先にMediaを作成してください。</p><Link href="/apps/media/new" className="mt-4 inline-flex text-sm font-bold text-[var(--mikke-primary)]">Mediaを作る</Link></div>;
  const filtered=items.filter(article=>(filter!=="published" || Boolean(article.publishedSnapshot)) && (filter!=="draft" || article.status!=="published" || Boolean(article.publishedSnapshot && article.updatedAt>article.publishedSnapshot.updatedAt)) && (!category || article.category===category) && (!month || (article.publishedSnapshot?.publishedAt??article.updatedAt).slice(0,7)===month) && article.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const pages=Math.max(1,Math.ceil(filtered.length/12));
  const current=Math.min(page,pages);
  return <div className={styles.root}><header className={styles.header}><h1>記事一覧</h1><Link href="/apps/media/write" className={styles.write}><PenLine size={14}/>記事を書く</Link></header>
    <nav aria-label="記事の状態" className="mt-3 flex gap-4 text-xs">{[["all","すべて"],["draft","書きかけ"],["published","公開中"]].map(([value,label])=><Link key={value} href={`/apps/media/articles?filter=${value}`} aria-current={filter===value?"page":undefined} className={filter===value?"font-bold text-[var(--mikke-primary)] underline":"text-[var(--mikke-text)]"}>{label}</Link>)}</nav>
    <div className={styles.filters}><input aria-label="記事を検索" placeholder="記事を検索" value={query} onChange={event=>setQuery(event.target.value)}/><select aria-label="カテゴリーで絞り込み" value={category} onChange={event=>setCategory(event.target.value)}><option value="">カテゴリー</option>{site.categories.map(value=><option key={value}>{value}</option>)}</select><input type="month" aria-label="月別で絞り込み" value={month} onChange={event=>setMonth(event.target.value)}/></div><p className={styles.count}>{filtered.length}件</p>
    {filtered.length === 0 ? <div className="mt-8 grid min-h-64 place-items-center rounded-3xl border border-dashed border-[var(--mikke-line)] bg-white text-center"><div><FileText className="mx-auto text-[var(--mikke-primary)]" /><p className="mt-4 font-bold">条件に合う記事はありません</p><p className="mt-2 text-sm text-[var(--mikke-muted)]">検索や絞り込みの条件を変えられます。</p></div></div> : <div className="mt-3 space-y-3">{filtered.slice((current-1)*12,current*12).map((article) => <Link key={article.id} href={`/apps/media/write?article=${article.id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-3 shadow-sm"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${article.publishedSnapshot ? "bg-emerald-50 text-emerald-700" : article.status === "unpublished" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"}`}>{article.publishedSnapshot ? "公開中" : article.status === "unpublished" ? "非公開" : "下書き"}</span>{article.publishedSnapshot && article.updatedAt > article.publishedSnapshot.updatedAt ? <span className="text-[10px] font-bold text-amber-700">未公開の変更あり</span> : null}</div><h2 className="mt-2 truncate font-bold">{article.title || "無題の記事"}</h2><p className="mt-1 text-xs text-[var(--mikke-muted)]">{new Date(article.updatedAt).toLocaleString("ja-JP")}・/{article.slug}</p></div><ArrowRight size={17} className="shrink-0 text-[var(--mikke-primary)]" /></Link>)}</div>}<nav aria-label="記事一覧のページ" className="mt-6 flex justify-center gap-4"><button disabled={current===1} onClick={()=>setPage(current-1)} className="disabled:opacity-30">前へ</button><span>{current} / {pages}</span><button disabled={current===pages} onClick={()=>setPage(current+1)} className="disabled:opacity-30">次へ</button></nav></div>;
}
