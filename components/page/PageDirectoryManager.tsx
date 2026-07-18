"use client";

import { type FormEvent, useState } from "react";
import { Handshake, Plus, Trash2, UsersRound } from "lucide-react";
import { createPageDirectoryItem, deletePageDirectoryItem } from "@/lib/page/store";
import type { PageDirectoryKind, PageSite } from "@/lib/page/types";

const inputClass = "mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";

export function PageDirectoryManager({ site, onChange }: { site: PageSite; onChange: () => void }) {
  const [kind, setKind] = useState<PageDirectoryKind>("connect");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      createPageDirectoryItem(site.id, { kind, name, category, description, imageUrl, linkUrl });
      setName("");
      setCategory("");
      setDescription("");
      setImageUrl("");
      setLinkUrl("");
      onChange();
      setMessage("CMS項目を追加しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CMS項目を追加できませんでした。");
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--mikke-primary-soft)] text-[var(--mikke-accent)]"><Handshake size={19} /></span>
        <div><h2 className="text-lg font-bold tracking-normal">Connect / Partners</h2><p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">このPage内で紹介する加盟・提携先、スポンサー、協力企業を管理します。独立アプリではありません。</p></div>
      </div>

      {site.directoryItems.length > 0 ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{site.directoryItems.map((item) => <article key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--mikke-line-soft)] bg-[var(--mikke-surface-soft)] p-3"><div className="flex min-w-0 gap-2">{item.kind === "connect" ? <UsersRound size={17} className="mt-0.5 shrink-0 text-[var(--mikke-accent)]" /> : <Handshake size={17} className="mt-0.5 shrink-0 text-[var(--mikke-accent)]" />}<div><p className="text-xs font-bold text-[var(--mikke-accent)]">{item.kind === "connect" ? "Connect" : "Partners"}</p><p className="mt-0.5 text-sm font-bold">{item.name}</p>{item.category ? <p className="mt-1 text-xs text-[var(--mikke-muted)]">{item.category}</p> : null}</div></div><button type="button" onClick={() => { if (!window.confirm(`「${item.name}」を削除しますか？`)) return; deletePageDirectoryItem(site.id, item.id); onChange(); }} aria-label={`${item.name}を削除`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--mikke-danger)]"><Trash2 size={14} /></button></article>)}</div> : <p className="mt-4 rounded-xl bg-[var(--mikke-surface-soft)] p-4 text-xs text-[var(--mikke-muted)]">CMS項目はまだありません。</p>}

      <form onSubmit={submit} className="mt-5 border-t border-[var(--mikke-line-soft)] pt-5">
        <h3 className="text-sm font-bold">CMS項目を追加</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="block"><span className="text-xs font-bold">種類</span><select value={kind} onChange={(event) => setKind(event.target.value as PageDirectoryKind)} className={inputClass}><option value="connect">Connect（加盟・提携）</option><option value="partners">Partners（スポンサー・協力）</option></select></label><label className="block"><span className="text-xs font-bold">掲載名 *</span><input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} maxLength={100} required /></label><label className="block"><span className="text-xs font-bold">区分</span><input value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass} placeholder="加盟団体、協力企業など" maxLength={80} /></label><label className="block"><span className="text-xs font-bold">リンク</span><input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} className={inputClass} placeholder="https://" maxLength={300} /></label><label className="block sm:col-span-2"><span className="text-xs font-bold">紹介文</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} resize-y`} rows={3} maxLength={300} /></label><label className="block sm:col-span-2"><span className="text-xs font-bold">画像URL</span><input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} className={inputClass} placeholder="https:// または /image.jpg" maxLength={500} /></label></div>
        {message ? <p role="status" className="mt-3 text-xs font-bold text-[var(--mikke-accent)]">{message}</p> : null}
        <div className="mt-4 flex justify-end"><button type="submit" disabled={!name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"><Plus size={16} /> CMS項目を追加</button></div>
      </form>
    </section>
  );
}
