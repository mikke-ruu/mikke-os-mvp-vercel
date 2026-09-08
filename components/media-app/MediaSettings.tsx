"use client";

import { useEffect, useState } from "react";
import { MediaAuthorSettings } from "./MediaAuthorSettings";
import { MediaLink as Link } from "./MediaNavigation";
import { useAuth } from "@/components/AuthGate";
import { getOwnedMedia, normalizeMediaSlug, updateMediaSite } from "@/lib/media-app/store";
import type { MediaSite } from "@/lib/media-app/types";

const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-3 text-sm font-normal";

export function MediaSettings() {
  const { profile } = useAuth();
  const [site, setSite] = useState<MediaSite | null>(null);
  const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [description, setDescription] = useState(""); const [authorName, setAuthorName] = useState(""); const [categories, setCategories] = useState("");
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  useEffect(() => { const next = getOwnedMedia(profile.id); setSite(next); if (next) { setName(next.name); setSlug(next.slug); setDescription(next.description); setAuthorName(next.authorName); setCategories(next.categories.join("\n")); } }, [profile.id]);
  if (!site || site.ownerProfileId !== profile.id) return <p className="rounded-2xl border border-dashed border-[var(--mikke-line)] p-8 text-center"><Link href="/apps/media/new" className="font-bold text-[var(--mikke-primary)]">先にMediaを作成してください</Link></p>;
  function save(event: React.FormEvent) { event.preventDefault(); setMessage(""); setError(""); try { const next = updateMediaSite(site!.id, { name, slug, description, authorName, categories: categories.split("\n") }); setSite(next); setSlug(next.slug); setMessage("設定を保存しました。"); } catch (cause) { setError(cause instanceof Error ? cause.message : "設定を保存できませんでした。"); } }
  return <div className="mx-auto max-w-3xl"><p className="text-xs font-black tracking-[0.14em] text-[var(--mikke-primary)]">MEDIA SETTINGS</p><h1 className="mt-2 text-3xl font-black">Media設定</h1><p className="mt-2 text-sm text-[var(--mikke-muted)]">媒体として表示する名前やカテゴリーを整えます。</p>{message ? <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</p> : null}{error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}<form onSubmit={save} className="mt-6 space-y-5 rounded-3xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm sm:p-7"><label className="block text-sm font-bold">Media名<input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} /></label><label className="block text-sm font-bold">公開URL名<input value={slug} onChange={(event) => setSlug(event.target.value)} onBlur={() => setSlug(normalizeMediaSlug(slug))} className={inputClass} /><span className="mt-1 block text-xs font-normal text-[var(--mikke-muted)]">/media/{normalizeMediaSlug(slug) || "your-media"}</span></label><label className="block text-sm font-bold">説明<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className={inputClass} /></label><label className="block text-sm font-bold">表示する名前<input value={authorName} onChange={(event) => setAuthorName(event.target.value)} className={inputClass} /></label><label className="block text-sm font-bold">カテゴリー（1行に1つ）<textarea value={categories} onChange={(event) => setCategories(event.target.value)} rows={5} className={inputClass} /></label><button type="submit" className="rounded-xl bg-[var(--mikke-primary)] px-5 py-3 text-sm font-bold text-white">設定を保存</button></form><MediaAuthorSettings key={site.id} site={site} /></div>;
}
