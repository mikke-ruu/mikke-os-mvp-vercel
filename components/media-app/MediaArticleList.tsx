"use client";
import styles from "./MediaArticleList.module.css";
import {saveCloudOrder} from "@/lib/media-app/cloud-library";
import {articleCategories} from "@/lib/media-app/categories";
import {MediaCollections} from "./MediaCollections";
import { useMediaRepository } from "./MediaRepository";

import { MediaLink as Link } from "./MediaNavigation";
import { useEffect, useRef, useState } from "react";
import { sortPublishedMediaArticles, updateLocalPublication } from "@/lib/media-app/store";
import { useSearchParams } from "next/navigation";
import { ArrowRight, FileText, PenLine } from "lucide-react";
import { useAuth } from "@/components/AuthGate";

import type { MediaArticle, MediaSite } from "@/lib/media-app/types";

export function MediaArticleList() {
  const { profile } = useAuth();
  const filter = useSearchParams().get("filter") ?? "all";
  const [category,setCategory]=useState("");
  const [month,setMonth]=useState("");
  const [query,setQuery]=useState("");
  const [page,setPage]=useState(1);
  useEffect(()=>setPage(1),[category,month,query,filter]);
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
  const shown = sortPublishedMediaArticles(items).filter(article => filter === "published" ? Boolean(article.publishedSnapshot) : filter === "draft" ? article.status !== "published" || Boolean(article.publishedSnapshot && article.updatedAt > article.publishedSnapshot.updatedAt) : true);
  const filtered=shown.filter(item=>(!category || (category==="__none"?!articleCategories(item).length:articleCategories(item).includes(category))) && (!month || (item.publishedSnapshot?.publishedAt ?? item.updatedAt).slice(0,7)===month) && item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const pages=Math.max(1,Math.ceil(filtered.length/12));
  const currentPage=Math.min(page,pages);
  return <div className={styles.root}><header className={styles.header}><h1>記事一覧</h1><Link href="/apps/media/write" className={styles.write}><PenLine size={14}/>記事を書く</Link></header><MediaCollections siteId={site.id} scope={`media:${profile.id}:${site.id}`} articles={items}/><div className={styles.filters}><input aria-label="記事を検索" placeholder="記事を検索" value={query} onChange={e=>setQuery(e.target.value)} className="rounded-lg border p-2"/><select aria-label="カテゴリーで絞り込み" value={category} onChange={e=>setCategory(e.target.value)} className="rounded-lg border p-2"><option value="">カテゴリー</option><option value="__none">カテゴリーなし</option>{Array.from(new Set([...site.categories,...items.flatMap(articleCategories)])).map(value=><option key={value}>{value}</option>)}</select><input type="month" aria-label="月別で絞り込み" value={month} onChange={e=>setMonth(e.target.value)} className="rounded-lg border p-2"/>{month?<button onClick={()=>setMonth("")}>月指定を解除</button>:null}</div><p className={styles.count}>{filtered.length}件</p>{filtered.length === 0 ? <div className="mt-8 grid min-h-64 place-items-center rounded-3xl border border-dashed border-[var(--mikke-line)] bg-white text-center"><div><FileText className="mx-auto text-[var(--mikke-primary)]" /><p className="mt-4 font-bold">{items.length?"条件に合う記事はありません":"記事はまだありません"}</p><p className="mt-2 text-sm text-[var(--mikke-muted)]">{items.length?"検索や絞り込みの条件を変えてください。":"最初のお知らせを書いてみましょう。"}</p></div></div> : <div className="mt-3 space-y-3">{filtered.slice((currentPage-1)*12,currentPage*12).map((article) => <div key={article.id} className={styles.item}><Link href={`/apps/media/write?article=${article.id}`} className="flex items-center justify-between gap-4 bg-white p-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${article.publishedSnapshot ? "bg-emerald-50 text-emerald-700" : article.status === "unpublished" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"}`}>{article.publishedSnapshot ? "公開中" : article.status === "unpublished" ? "非公開" : "下書き"}</span>{article.publishedSnapshot && article.updatedAt > article.publishedSnapshot.updatedAt ? <span className="text-[10px] font-bold text-amber-700">未公開の変更あり</span> : null}</div>{article.pinned?<span className="text-xs font-bold">上部固定</span>:null}{articleCategories(article).map(c=><span key={c} className="ml-2 text-xs">{c}</span>)}<h2 className="mt-2 truncate font-bold">{article.title || "無題の記事"}</h2><p className="mt-1 text-xs text-[var(--mikke-muted)]">{new Date(article.updatedAt).toLocaleString("ja-JP")}</p></div><ArrowRight size={17} className="shrink-0 text-[var(--mikke-primary)]" /></Link>{article.publishedSnapshot ? <LocalPublicationSettings article={article} siblings={sortPublishedMediaArticles(items).filter(item=>item.publishedSnapshot && Boolean(item.pinned)===Boolean(article.pinned))} owner={profile.id} onChange={setItems} cloudSave={repository.cloud?async input=>{await saveCloudOrder(profile.user_id,article.id,input);setItems(await listMediaArticles(site.id));}:undefined} /> : null}</div>)}</div>}<nav aria-label="記事一覧のページ" className="mt-6 flex items-center justify-center gap-4"><button disabled={currentPage===1} onClick={()=>setPage(currentPage-1)} className="disabled:opacity-30">前へ</button><span>{currentPage} / {pages}</span><button disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)} className="disabled:opacity-30">次へ</button></nav></div>;
}

function LocalPublicationSettings({ article, siblings, owner, onChange, cloudSave }: { article: MediaArticle; siblings: MediaArticle[]; owner: string; onChange: (items: MediaArticle[]) => void;cloudSave?:(input:{date?:string;direction?:-1|1;pinned?:boolean})=>Promise<void> }) {
  const position=siblings.findIndex(item=>item.id===article.id);
  const stamp = new Date(article.displayDate??article.publishedSnapshot!.publishedAt);
  const dateInput = useRef<HTMLInputElement>(null);
  const date = new Date(stamp.getTime() - stamp.getTimezoneOffset() * 60000).toISOString().slice(0,16);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  async function update(input: {date?: string; direction?: -1 | 1; pinned?: boolean}) { try {if(cloudSave)await cloudSave(input);else onChange(updateLocalPublication(article.id, owner, input));setError("");setMessage(input.date ? "表示日時を保存しました。" : "公開一覧の順序を保存しました。");} catch(cause){setError(cause instanceof Error ? cause.message : "変更できませんでした。");} }
  return <div className={styles.publication}><div className={styles.controls}><input type="datetime-local" aria-label={article.title+"の表示日時"} ref={dateInput} defaultValue={date} className="rounded-lg border border-[var(--mikke-line)] p-2" /><button type="button" onClick={()=>update({date:dateInput.current?.value??""})} className="rounded-lg border p-2">日時保存</button><button type="button" disabled={position<=0} onClick={()=>update({direction:-1})} className="rounded-lg border p-2 disabled:opacity-30" aria-label={article.title+"を公開順で上へ"}>↑</button><button type="button" disabled={position>=siblings.length-1} onClick={()=>update({direction:1})} className="rounded-lg border p-2 disabled:opacity-30" aria-label={article.title+"を公開順で下へ"}>↓</button><button type="button" aria-pressed={Boolean(article.pinned)} onClick={()=>update({pinned:!article.pinned})} className="rounded-lg border p-2">{article.pinned?"固定解除":"上部固定"}</button></div>{message ? <p role="status" className="text-[var(--mikke-orange)]">{message}</p> : null}{error ? <p role="alert">{error}</p> : null}</div>;
}
