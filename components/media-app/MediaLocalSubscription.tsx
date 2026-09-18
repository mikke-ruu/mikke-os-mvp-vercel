"use client";
import {useEffect,useState} from "react";
import type {MediaArticle} from "@/lib/media-app/types";
import {listLibrary,putLibrary,type LibraryRecord} from "@/lib/mikkeos/content/local-library";
import {MediaLink} from "./MediaNavigation";
type Subscription={enabled:boolean;lastRead:string};
export function MediaLocalSubscription({scope,articles}:{scope:string;articles:MediaArticle[]}) {
  const [record,setRecord]=useState<LibraryRecord<Subscription>>(),[loaded,setLoaded]=useState(false),[error,setError]=useState("");
  useEffect(()=>{let active=true;void listLibrary<Subscription>(scope,"subscription").then(items=>{if(active){setRecord(items[0]);setLoaded(true);}}).catch(()=>setError("更新通知の設定を読み込めませんでした。"));return()=>{active=false;};},[scope]);
  async function update(enabled:boolean,lastRead=new Date().toISOString()){try{const next=await putLibrary(scope,"subscription","更新通知",{enabled,lastRead},record?.id);setRecord(next);setError("");}catch{setError("更新通知の設定を保存できませんでした。");}}
  const unread=record?.value.enabled?articles.filter(article=>article.publishedSnapshot&&article.publishedSnapshot.updatedAt>record.value.lastRead):[];
  return <section className="mt-7 border-t border-[var(--mikke-line)] pt-5"><h2 className="text-sm font-bold">更新通知</h2><p className="mt-2 text-xs leading-6 text-[var(--mikke-muted)]">このブラウザで新しい記事や更新を確認できます。メール配信は準備中です。</p><button type="button" disabled={!loaded} onClick={()=>void update(!record?.value.enabled)} className="mt-3 rounded-lg border px-3 py-2 text-sm">{record?.value.enabled?"更新通知を停止":"更新通知を受け取る"}</button>{record?.value.enabled?<div className="mt-4 text-sm"><p>未読の更新 {unread.length}件</p>{unread.map(article=><MediaLink key={article.id} href={`/apps/media/reader?published=1&article=${article.id}`} className="mt-2 block underline">{article.publishedSnapshot!.title}</MediaLink>)}{unread.length?<button type="button" className="mt-3 underline" onClick={()=>void update(true)}>すべて確認済みにする</button>:null}</div>:null}{error?<p role="alert" className="mt-2 text-xs">{error}</p>:null}</section>;
}
