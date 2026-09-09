"use client";
import { useMediaRepository } from "./MediaRepository";

import { useEffect, useRef, useState } from "react";
import { useMediaRouter as useRouter } from "./MediaNavigation";
import { useAuth } from "@/components/AuthGate";
import { normalizeMediaSlug } from "@/lib/media-app/store";
import type { MediaActiveTerms } from "@/lib/media-app/cloud-repository";

const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-3 text-sm font-normal";

export function MediaSetupForm() {
  const router = useRouter();
  const {createMediaSite,cloud,currentTerms,acceptTerms} = useMediaRepository();
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [authorName, setAuthorName] = useState(profile.display_name ?? "");
  const [error, setError] = useState("");
  const [terms,setTerms]=useState<MediaActiveTerms|null>(null);
  const [agreed,setAgreed]=useState(false);
  const submitting = useRef(false);
  useEffect(()=>{setName("");setSlug("");setDescription("");setAuthorName(profile.display_name??"");setError("");setTerms(null);setAgreed(false);},[profile.user_id]);
  useEffect(()=>{let alive=true;if(!cloud)return;void currentTerms().then(value=>{if(alive)setTerms(value);}).catch(()=>{if(alive)setError("利用条件を読み込めませんでした。時間をおいて開き直してください。");});return()=>{alive=false;};},[cloud,currentTerms]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError("");
    try {
      if(cloud){
        if(!terms)throw Error("利用条件を準備中のため、まだMediaを作成できません。");
        if(!terms.accepted){if(!agreed)throw Error("4つの文書を確認し、同意してください。");await acceptTerms(terms);setTerms({...terms,accepted:true});}
      }
      await createMediaSite({ ownerProfileId: profile.id, name, slug, description, authorName });
      router.push("/apps/media");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mediaを作成できませんでした。");
    } finally {
      submitting.current = false;
    }
  }

  return <div className="mx-auto max-w-2xl"><div><p className="text-xs font-black tracking-[0.14em] text-[var(--mikke-primary)]">MEDIA FREE</p><h1 className="mt-2 text-3xl font-black">自分のMediaをつくる</h1><p className="mt-3 text-sm leading-7 text-[var(--mikke-muted)]">名前と公開URLを決めれば、すぐに最初の記事を書けます。</p></div>{error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}<form onSubmit={submit} className="mt-6 space-y-5 rounded-3xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm sm:p-7"><label className="block text-sm font-bold">Media名<input value={name} onChange={(event) => { setName(event.target.value); if (!slug) setSlug(normalizeMediaSlug(event.target.value)); }} placeholder="例：AYUMI JOURNAL" className={inputClass} /></label><label className="block text-sm font-bold">公開URL名<input value={slug} onChange={(event) => setSlug(event.target.value)} onBlur={() => setSlug(normalizeMediaSlug(slug))} placeholder="ayumi-journal" className={inputClass} /><span className="mt-1 block text-xs font-normal text-[var(--mikke-muted)]">/media/{normalizeMediaSlug(slug) || "your-media"}</span></label><label className="block text-sm font-bold">Mediaの説明<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="何を発信するMediaか、短く紹介します。" className={inputClass} /></label><label className="block text-sm font-bold">表示する名前<input value={authorName} onChange={(event) => setAuthorName(event.target.value)} placeholder="本名・ペンネーム・編集部名" className={inputClass} /></label>{cloud?<section className="rounded-2xl bg-[var(--mikke-surface-soft)] p-4 text-sm leading-7"><p className="font-bold">初回利用の確認</p><p className="mt-2">18歳以上の方が利用できます。次の4文書を確認してください。</p><nav className="mt-2 flex flex-wrap gap-x-4"><a className="underline" target="_blank" rel="noreferrer" href="/legal/media/free/terms/2026-09-09-v1">利用条件</a><a className="underline" target="_blank" rel="noreferrer" href="/legal/media/free/privacy/2026-09-09-v1">プライバシー</a><a className="underline" target="_blank" rel="noreferrer" href="/legal/media/free/content-publication/2026-09-09-v1">投稿ルール</a><a className="underline" target="_blank" rel="noreferrer" href="/legal/media/free/report-data/2026-09-09-v1">削除・保存</a></nav>{terms?.accepted?<p className="mt-3 font-bold text-emerald-700">現在の利用条件に同意済みです。</p>:<label className="mt-3 block"><input type="checkbox" checked={agreed} onChange={event=>setAgreed(event.target.checked)}/> 4文書を確認し、18歳以上であることと、自分で権利と公開範囲を確認して記事を公開することに同意します</label>}</section>:null}<button type="submit" disabled={cloud&&(!terms||(!terms.accepted&&!agreed))} className="w-full rounded-xl bg-[var(--mikke-primary)] px-5 py-3.5 text-sm font-bold text-white disabled:opacity-40">Mediaを作成する</button></form><p className="mt-4 text-center text-xs leading-6 text-[var(--mikke-muted)]">Freeでは1つのMediaを作成できます。{cloud ? "ログインしたアカウントに保存されます。" : "この段階ではこの端末内に保存されます。"}</p></div>;
}
