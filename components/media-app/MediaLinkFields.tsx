"use client";
import { mediaYoutubeId } from "@/lib/media-app/youtube";
import { useEffect, useRef, useState } from "react";
import type { MediaBlock } from "@/lib/media-app/types";
import { useMediaRepository } from "./MediaRepository";
import { MediaImagePicker } from "./MediaImagePicker";
import { supabase } from "@/lib/supabase/client";
import { MediaLinkCard } from "./MediaLinkCard";
export function MediaLinkFields({ block, onChange }: {block:MediaBlock;onChange:(block:MediaBlock)=>void}) {
  const {cloud}=useMediaRepository();const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [attempt,setAttempt]=useState(0);
  const latest=useRef(block);latest.current=block;const change=useRef(onChange);change.current=onChange;
  const attempted=useRef("");
  useEffect(()=>{
    const url=block.url?.trim()??"";setError("");setBusy(false);
    if(mediaYoutubeId(url))return;
    if(!/^https:\/\//i.test(url))return;
    // Persisted metadata does not need another network request on every editor visit.
    if(attempt===0 && (block.imageUrl||block.text) && attempted.current!==url)return;
    let alive=true;const controller=new AbortController();
    const timer=setTimeout(()=>{attempted.current=url;setBusy(true);void (async()=>{
      try {
        const {data:session}=await supabase.auth.getSession();
        const subject=session.session?.user.id;
        const response=await fetch("/api/media/link-preview",{method:"POST",headers:{"Content-Type":"application/json",...(session.session?{Authorization:`Bearer ${session.session.access_token}`}:{})},body:JSON.stringify({url}),signal:controller.signal});
        if(!response.ok)throw Error();const data=await response.json();
        if(cloud){const {data:latestSession}=await supabase.auth.getSession();if(!subject||latestSession.session?.user.id!==subject)return;}
        if(!alive||latest.current.url?.trim()!==url)return;
        const current=latest.current;
        change.current({...current,title:current.title||data.title||"",text:current.text||data.description||"",imageUrl:current.imageUrl||data.imageUrl||""});
      } catch {if(alive)setError("このリンクの情報を取得できませんでした。リンク自体はそのまま使えます。");}
      finally {if(alive)setBusy(false);}
    })();},550);
    return()=>{alive=false;clearTimeout(timer);controller.abort();};
  },[block.url,cloud,attempt]);
  const input="mt-2 w-full rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm font-normal";
  return <div><input aria-label="リンク先URL" value={block.url??""} placeholder="リンク先のURLを貼り付ける" onChange={event=>onChange({...block,url:event.target.value,title:"",imageUrl:"",imageAssetId:undefined,text:""})} className={input}/>{busy?<p role="status" className="mt-3 text-sm text-[var(--mikke-muted)]">リンクカードを作成しています…</p>:null}<MediaLinkCard block={block}/>{error?<div role="status" className="mt-3 text-sm text-[var(--mikke-muted)]"><p>{error}</p><button type="button" onClick={()=>setAttempt(value=>value+1)} className="mt-2 underline">もう一度取得する</button></div>:null}<details className="mt-2 text-xs text-[var(--mikke-muted)]"><summary className="cursor-pointer">カードを編集</summary><label className="mt-3 block">表示名<input value={block.title??""} onChange={event=>onChange({...block,title:event.target.value})} className={input}/></label>{<><label className="mt-3 block">紹介文<textarea value={block.text??""} maxLength={300} onChange={event=>onChange({...block,text:event.target.value})} className={input}/></label><MediaImagePicker sourceApp="media-article" compact currentUrl={block.imageUrl} onSelect={asset=>onChange({...block,imageUrl:asset.publicUrl,imageAssetId:asset.id})}/></>}</details></div>;
}
