"use client";
import { useRef, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase/client";
import { MediaImage } from "./MediaImage";
export function MediaPrivateImagePicker({currentUrl,onSelect}:{currentUrl?:string;onSelect:(asset:{id:string;publicUrl:string;originalName:string})=>void}){
  const {profile}=useAuth();const fileInput=useRef<HTMLInputElement>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function choose(file?:File){if(!file||busy)return;setBusy(true);setError("");
    try{if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>15*1024*1024)throw Error("15MB以下のJPG・PNG・WebPを選択してください。");
      const subject=profile.user_id;const bitmap=await createImageBitmap(file);let blob:Blob|null=null;
      try{for(const quality of [.82,.72,.64]){const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext("2d")?.drawImage(bitmap,0,0,canvas.width,canvas.height);blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",quality));if(blob&&blob.size<=3*1024*1024)break;}}finally{bitmap.close();}
      if(!blob||blob.size>3*1024*1024)throw Error("画像を3MB以下にできませんでした。");
      const {data}=await supabase.auth.getSession();if(!data.session||data.session.user.id!==subject)throw Error("ログイン状態を確認してください。");
      const response=await fetch("/api/media/assets",{method:"POST",headers:{Authorization:`Bearer ${data.session.access_token}`,"Content-Type":"image/webp"},body:blob});
      const result=await response.json();if(!response.ok)throw Error(result.message||"画像を保存できませんでした。");
      const latest=await supabase.auth.getUser();if(latest.data.user?.id!==subject)throw Error("ログイン状態が変わりました。");
      onSelect({id:result.assetId,publicUrl:result.imageUrl,originalName:file.name});
    }catch(cause){setError(cause instanceof Error?cause.message:"画像を保存できませんでした。");}finally{setBusy(false);if(fileInput.current)fileInput.current.value="";}
  }
  return <div className="rounded-xl border border-[var(--mikke-line)] p-4">{currentUrl?<MediaImage src={currentUrl} alt="選択した画像" className="mb-3 max-h-40 rounded-lg"/>:null}<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event=>void choose(event.target.files?.[0])}/><button type="button" disabled={busy} onClick={()=>fileInput.current?.click()} className="rounded-lg bg-[var(--mikke-primary)] px-4 py-2 text-sm text-white">{busy?"画像を保存しています…":"画像を選ぶ"}</button><p className="mt-2 text-xs">画像は非公開で保存します。記事を公開するまでは本人だけが確認できます。</p>{error?<p role="alert" className="mt-2 text-sm">{error}</p>:null}</div>;
}
