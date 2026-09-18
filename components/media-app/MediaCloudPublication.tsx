"use client";
import { useEffect,useMemo,useRef,useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase/client";
import { createMediaCloudRepository,type MediaActiveTerms,type MediaPublicationReview } from "@/lib/media-app/cloud-repository";
import type {MediaArticle} from "@/lib/media-app/types";
import {MediaArticleRenderer} from "./MediaArticleRenderer";
type LoadState="loading"|"ready"|"error";
export function MediaCloudPublication({articleId,updating=false,onCancel,onPublished}:{articleId:string;updating?:boolean;onCancel:()=>void;onPublished:(article:MediaArticle)=>void}){
  const {profile}=useAuth();const repository=useMemo(()=>createMediaCloudRepository(supabase,profile.user_id),[profile.user_id]);
  const [review,setReview]=useState<MediaPublicationReview|null>(null);const [terms,setTerms]=useState<MediaActiveTerms|null>(null);
  const [reviewState,setReviewState]=useState<LoadState>("loading");const [termsState,setTermsState]=useState<LoadState>("loading");
  const [reviewAttempt,setReviewAttempt]=useState(0);const [termsAttempt,setTermsAttempt]=useState(0);
  const [reviewError,setReviewError]=useState("原稿を確認できませんでした。");
  const [agree,setAgree]=useState(false);const [rights,setRights]=useState(false);const [privacy,setPrivacy]=useState(false);const [free,setFree]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{let alive=true;setReviewState("loading");setReview(null);void repository.reviewArticle(articleId).then(value=>{if(alive){setReview(value);setReviewState("ready");}}).catch(caught=>{if(alive){setReviewError(caught instanceof Error&&caught.message?caught.message:"原稿を確認できませんでした。");setReviewState("error");}});return()=>{alive=false;};},[repository,articleId,reviewAttempt]);
  useEffect(()=>{let alive=true;setTermsState("loading");setTerms(null);void repository.currentTerms().then(value=>{if(!alive)return;if(value){setTerms(value);setTermsState("ready");}else setTermsState("error");}).catch(()=>{if(alive)setTermsState("error");});return()=>{alive=false;};},[repository,termsAttempt]);
  const inFlight=useRef(false);
  async function accept(){if(!terms||!agree||inFlight.current)return;inFlight.current=true;setBusy(true);setError("");try{await repository.acceptTerms(terms);setTerms({...terms,accepted:true});}catch{setError("同意を保存できませんでした。もう一度確認してください。");}finally{inFlight.current=false;setBusy(false);}}
  async function publish(){if(!review||!terms?.accepted||!rights||!privacy||!free||inFlight.current)return;inFlight.current=true;setBusy(true);setError("");try{onPublished(await repository.publishReviewedArticle(articleId,review.expectedRevision,terms));}catch{setError("公開できませんでした。原稿や利用条件が変更された可能性があります。執筆画面に戻って確認し直してください。");setRights(false);setPrivacy(false);setFree(false);}finally{inFlight.current=false;setBusy(false);}}
  return <section className="mx-auto max-w-3xl pb-12"><h1 className="text-2xl font-bold">公開前の最終確認</h1><p className="mt-3 text-sm">この内容を公開します。確認後に原稿が変更された場合は公開しません。</p>{error?<p role="alert" className="my-4">{error}</p>:null}{reviewState==="ready"&&review?<><p className="mt-6 text-sm">{review.snapshot.site.name} ／ 発信者：{review.snapshot.site.authorName}</p><MediaArticleRenderer article={{...review.snapshot,publishedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}} preview/></>:reviewState==="error"?<div role="alert" className="my-6 rounded-xl border border-[var(--mikke-line)] p-5"><p>{reviewError}</p><button type="button" onClick={()=>setReviewAttempt(value=>value+1)} className="mt-3 rounded-lg border px-4 py-2">原稿を読み直す</button></div>:<p className="py-10">原稿を確認しています…</p>}
    <fieldset disabled={busy} className="mt-8 space-y-4 rounded-xl border border-[var(--mikke-line)] p-5">
      {termsState==="loading"?<p>利用条件を確認しています…</p>:termsState==="error"?<div role="alert"><p>利用条件を確認できませんでした。</p><button type="button" onClick={()=>setTermsAttempt(value=>value+1)} className="mt-3 rounded-lg border px-4 py-2">利用条件を読み直す</button></div>:terms&&!terms.accepted?<><p>初回公開の前に利用条件への同意が必要です。</p><a href={terms.documentUrl} target="_blank" rel="noreferrer" className="underline">Mediaの利用条件を読む</a><label className="block"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/> 利用条件を読み、同意します</label><button type="button" disabled={!agree} onClick={accept} className="rounded-lg border px-4 py-2">同意を保存</button></>:terms?<p className="text-sm">現在の利用条件に同意済みです。</p>:null}
      <label className="block text-sm"><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/> 文章・画像を公開する権利を確認しました</label>
      <label className="block text-sm"><input type="checkbox" checked={privacy} onChange={e=>setPrivacy(e.target.checked)}/> 個人情報や人物の掲載許可を確認しました</label>
      <label className="block text-sm"><input type="checkbox" checked={free} onChange={e=>setFree(e.target.checked)}/> 広告・PR・アフィリエイトを含んでいません</label>
      <p className="text-xs">公開後は世界中から閲覧できます。公開をキャンセルしても、検索結果や第三者の保存をすべて消せるわけではありません。</p>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2">執筆に戻る</button><button type="button" onClick={publish} disabled={busy||!terms?.accepted||!rights||!privacy||!free||!review} className="rounded-lg bg-[var(--mikke-orange)] px-4 py-2 font-semibold text-white disabled:opacity-40">{busy?"処理しています…":updating?"この内容に更新する":"この内容を公開する"}</button></div>
    </fieldset></section>;
}
