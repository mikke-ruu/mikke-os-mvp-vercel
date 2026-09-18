"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthGate";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { KoushiShell } from "@/components/academy/AcademyShell";
import { QrCode } from "@/components/academy/QrCode";
import { AcademyImageUploader } from "@/components/academy/AcademyImageUploader";
import { AcademyContentRenderer } from "@/components/academy/AcademyContentRenderer";
import { LpCanvas } from "@/components/mikkeos/page-builder/LpCanvas";
import { LpDesignFields } from "@/components/mikkeos/page-builder/LpDesign";
import { MikkeBlockFields } from "@/components/mikkeos/content/MikkeBlockFields";
import { offeringError, type AcademyOffering } from "@/lib/academy/offerings";
import { listEligibleInstructorOfferings, listMyOfferingPages, saveInstructorOfferingPage, type InstructorOfferingPage, type InstructorOfferingProfile } from "@/lib/academy/instructor-offerings";

const input = "mt-1 w-full min-h-11 rounded-lg border border-[var(--mikke-line)] bg-white p-3 text-base";
function Editor({ offering, initial, onSaved }: { offering: AcademyOffering; initial?: InstructorOfferingPage; onSaved: (page: InstructorOfferingPage) => void }) {
  const [page, setPage] = useState(() => ({ id: initial?.id, offering_id: offering.id, profile: initial?.profile ?? { display_name: "", bio: "", image_url: "", contact_email: "", application_note: "" }, lp_blocks: initial?.lp_blocks ?? [], status: initial?.status ?? "draft" }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const lock = useRef(false);
  useEffect(() => { if (!dirty) return; const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  function profile(key: keyof InstructorOfferingProfile, value: string) { setPage(prev => ({ ...prev, profile: { ...prev.profile, [key]: value } })); setDirty(true); setSaved(false); }
  async function save() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setSaved(false);
    try { const result = await saveInstructorOfferingPage(page); setPage(result); onSaved(result); setDirty(false); setSaved(true); }
    catch (cause) { setError(offeringError(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  const url = initial?.status === "published" && typeof window !== "undefined" ? `${window.location.origin}/academy/oi/${initial.id}` : "";
  return <section className="space-y-4 border-t border-[var(--mikke-line)] pt-5"><h2 className="text-lg font-bold">{offering.title}</h2><p className="text-sm">講座内容と価格は本部の募集を使います。ご自身のプロフィールと追加の案内を入力してください。</p><Link className="text-sm underline" href={`/academy/o/${offering.id}`} target="_blank" rel="noopener noreferrer">本部の募集内容を確認</Link>
    {error && <p role="alert" className="text-sm text-red-700">{error} 入力内容は残っています。</p>}
    <fieldset disabled={busy} className="space-y-4">
      {([['display_name', '表示名'], ['bio', 'プロフィール'], ['contact_email', '公開する連絡先メール'], ['application_note', '申込前のご案内']] as const).map(([key, label]) => <label key={key} className="block text-sm font-bold">{label}{key === "bio" || key === "application_note" ? <textarea className={input} value={page.profile[key]} onChange={e => profile(key, e.target.value)} /> : <input type={key === "contact_email" ? "email" : "text"} className={input} value={page.profile[key]} onChange={e => profile(key, e.target.value)} />}</label>)}
      <div><p className="mb-2 text-sm font-bold">プロフィール画像</p><AcademyImageUploader compact currentUrl={page.profile.image_url} onUploaded={url => profile("image_url", url)} /></div>
      <details><summary className="min-h-11 cursor-pointer py-3 font-bold">追加の案内を編集</summary><LpCanvas title="講師からのご案内" blocks={page.lp_blocks} onChange={blocks => { setPage(prev => ({ ...prev, lp_blocks: blocks })); setDirty(true); setSaved(false); }} renderContent={blocks => <AcademyContentRenderer blocks={blocks} />} renderFields={(block, update, tab) => tab === "design" ? <LpDesignFields expanded block={block} onChange={update} /> : <MikkeBlockFields block={block} onChange={update} onSplit={() => {}} ImagePicker={({ currentUrl, onSelect }) => <AcademyImageUploader compact currentUrl={currentUrl} onUploaded={publicUrl => onSelect({ publicUrl })} />} LinkEditor={({ block: link, onChange }) => <label>リンク先<input className={input} value={link.url ?? ""} onChange={e => onChange({ ...link, url: e.target.value })} /></label>} />} /></details>
      <label className="block text-sm font-bold">公開状態<select className={input} value={page.status} onChange={e => { setPage(prev => ({ ...prev, status: e.target.value as InstructorOfferingPage["status"] })); setDirty(true); setSaved(false); }}><option value="draft">下書き</option><option value="published">公開する</option><option value="archived">受付を終了</option></select></label>
      <button type="button" onClick={save} className="min-h-12 rounded-lg bg-[var(--mikke-accent)] px-6 py-3 font-bold text-white">{busy ? "保存中…" : "保存する"}</button>
    </fieldset>{saved && <p role="status" className="text-sm">保存しました。</p>}{url && <div className="space-y-3"><Link className="block break-all text-sm underline" href={url} target="_blank" rel="noopener noreferrer">自分の募集ページと申込フォームを確認</Link><QrCode url={url} filename={`academy-offering-${initial?.id}`} /></div>}
  </section>;
}
function Content() {
  const { profile } = useAuth();
  const [offerings, setOfferings] = useState<AcademyOffering[]>([]);
  const [pages, setPages] = useState<InstructorOfferingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [ending, setEnding] = useState<string | null>(null);
  const endingLock = useRef(false);
  async function endPage(page: InstructorOfferingPage) {
    if (endingLock.current || !window.confirm("この募集ページの受付を終了しますか？申込履歴は残ります。")) return;
    endingLock.current = true; setEnding(page.id);
    try { const result = await saveInstructorOfferingPage({ ...page, status: "archived" }); setPages(prev => prev.map(item => item.id === result.id ? result : item)); }
    catch (cause) { setError(offeringError(cause)); }
    finally { endingLock.current = false; setEnding(null); }
  }
  useEffect(() => { let active = true; setLoading(true); setError(""); setOfferings([]); setPages([]); Promise.all([listEligibleInstructorOfferings(), listMyOfferingPages(profile.user_id)]).then(([eligible, saved]) => { if (active) { setOfferings(eligible); setPages(saved); } }).catch(cause => { if (active) setError(offeringError(cause)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [profile.user_id, retry]);
  if (loading) return <p>募集を読み込み中…</p>;
  if (error) return <div role="alert"><p>{error}</p><button className={input} onClick={() => setRetry(n => n + 1)}>再読み込み</button></div>;
  return <div className="mx-auto max-w-4xl space-y-5"><Link href="/academy/portal/url" className="text-sm underline">講座ごとの営業用URLへ</Link><p className="text-sm">本部が公開した募集のうち、担当できる講座の募集を表示しています。本部の公開状態や講師資格が変わると受付できなくなります。</p>{pages.filter(page => !offerings.some(offering => offering.id === page.offering_id) && page.status !== "archived").map(page => <div key={page.id} className="border-b py-3 text-sm"><p>{page.profile.display_name || "保存済みの募集"}：本部の公開状態または資格を確認してください。現在は公開・編集できません。</p><button disabled={Boolean(ending)} type="button" className={input} onClick={() => endPage(page)}>{ending === page.id ? "終了中…" : "この募集ページを終了する"}</button></div>)}{!offerings.length && <p>現在利用できる本部の募集はありません。</p>}{offerings.map(offering => <Editor key={`${profile.user_id}:${offering.id}`} offering={offering} initial={pages.find(page => page.offering_id === offering.id)} onSaved={result => setPages(prev => [...prev.filter(page => page.id !== result.id), result])} />)}</div>;
}
export default function Page() { return <KoushiShell title="自分の募集ページ"><div className="mx-auto mb-4 max-w-4xl"><Link className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--mikke-primary)]" href={toCurrentAcademyContextHref("/academy/portal/offering-applications")}>この募集ページからの申込を確認する →</Link></div><Content /></KoushiShell>; }
