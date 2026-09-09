"use client";
import { useEffect,useMemo,useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase/client";
import { createMediaCloudRepository,type MediaActiveTerms,type MediaPublicationReview } from "@/lib/media-app/cloud-repository";
import type {MediaArticle} from "@/lib/media-app/types";
import {MediaArticleRenderer} from "./MediaArticleRenderer";
export function MediaCloudPublication({articleId,onCancel,onPublished}:{articleId:string;onCancel:()=>void;onPublished:(article:MediaArticle)=>void}){
  const {profile}=useAuth();const repository=useMemo(()=>createMediaCloudRepository(supabase,profile.user_id),[profile.user_id]);
  const [review,setReview]=useState<MediaPublicationReview|null>(null);const [terms,setTerms]=useState<MediaActiveTerms|null>(null);
  const [agree,setAgree]=useState(false);const [rights,setRights]=useState(false);const [privacy,setPrivacy]=useState(false);const [free,setFree]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{let alive=true;void Promise.all([repository.reviewArticle(articleId),repository.currentTerms()]).then(([r,t])=>{if(alive){setReview(r);setTerms(t);}}).catch(()=>{if(alive)setError("公開前の確認を読み込めませんでした。");});return()=>{alive=false;};},[repository,articleId]);
  async function accept(){if(!terms||!agree||busy)return;setBusy(true);try{await repository.acceptTerms(terms);setTerms({...terms,accepted:true});}catch{setError("同意を保存できませんでした。もう一度確認してください。");}finally{setBusy(false);}}
  async function publish(){if(!review||!terms?.accepted||!rights||!privacy||!free||busy)return;setBusy(true);try{onPublished(await repository.publishReviewedArticle(articleId,review.expectedRevision,terms));}catch{setError("公開できませんでした。原稿や利用条件が変更された可能性があります。執筆画面に戻って確認し直してください。");}finally{setBusy(false);}}
  return <section className="mx-auto max-w-3xl pb-12"><h1 className="text-2xl font-bold">公開前の最終確認</h1><p className="mt-3 text-sm">この内容を公開します。確認後に原稿が変更された場合は公開しません。</p>{error?<p role="alert" className="my-4">{error}</p>:null}{review?<><p className="mt-6 text-sm">{review.snapshot.site.name} ／ 書き手：{review.snapshot.site.authorName}</p><MediaArticleRenderer article={{...review.snapshot,publishedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}} preview/></>:<p className="py-10">原稿を確認しています…</p>}
    <fieldset disabled={busy} className="mt-8 space-y-4 rounded-xl border border-[var(--mikke-line)] p-5">
      {!terms?<p>利用条件を準備中のため、まだ公開できません。下書きは保存されています。</p>:!terms.accepted?<><p>初回公開の前に利用条件への同意が必要です。</p><a href={terms.documentUrl} target="_blank" rel="noreferrer" className="underline">Mediaの利用条件を読む</a><label className="block"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/> 利用条件を読み、同意します</label><button type="button" disabled={!agree} onClick={accept} className="rounded-lg border px-4 py-2">同意を保存</button></>:<p className="text-sm">現在の利用条件に同意済みです。</p>}
      <label className="block text-sm"><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/> 文章・画像を公開する権利を確認しました</label>
      <label className="block text-sm"><input type="checkbox" checked={privacy} onChange={e=>setPrivacy(e.target.checked)}/> 個人情報や人物の掲載許可を確認しました</label>
      <label className="block text-sm"><input type="checkbox" checked={free} onChange={e=>setFree(e.target.checked)}/> 広告・PR・アフィリエイトを含んでいません</label>
      <p className="text-xs">公開後は世界中から閲覧できます。公開をキャンセルしても、検索結果や第三者の保存をすべて消せるわけではありません。</p>
      <div className="flex gap-3"><button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2">執筆に戻る</button><button type="button" onClick={publish} disabled={!terms?.accepted||!rights||!privacy||!free||!review} className="rounded-lg bg-[var(--mikke-primary)] px-4 py-2 text-white disabled:opacity-40">{busy?"処理しています…":"この内容を公開する"}</button></div>
    </fieldset></section>;
}
