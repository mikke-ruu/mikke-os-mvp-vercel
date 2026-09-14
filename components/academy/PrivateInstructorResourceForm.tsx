"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { createPrivateInstructorMaterial } from "@/lib/academy/private-material-client";
import { PrivateMaterialFiles } from "./PrivateMaterialFiles";

export function PrivateInstructorResourceForm({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [requiresActive, setRequiresActive] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const locked = useRef(false);
  async function create() {
    if (!title.trim() || locked.current || parentId || uncertain) return;
    locked.current = true; setBusy(true); setError("");
    try { const material = await createPrivateInstructorMaterial({ courseId, title: title.trim(), requiresActive, isPublished: false }, profile.user_id); setParentId(material.id); }
    catch (e) { setError(e instanceof Error ? e.message : "資料を作成できませんでした。"); setUncertain(true); }
    finally { locked.current = false; setBusy(false); }
  }
  return <section className="space-y-3 border-t border-[var(--mikke-line)] py-4">
    <button type="button" disabled={busy} onClick={onClose} className="min-h-11 text-sm text-[var(--mikke-primary)]">← マニュアルの編集に戻る</button>
    <h3 className="font-bold">PDF資料を追加</h3>
    {parentId ? <><p className="text-sm">資料は下書きです。PDFを追加したあと、一覧で「マニュアルに表示」に切り替えられます。</p><PrivateMaterialFiles parent={{ audience: "instructor", parentId }} editable /></> : <>
      <label className="block text-sm">資料名<input className="mt-2 block w-full border-b border-[var(--mikke-line)] bg-transparent p-2" value={title} disabled={busy || uncertain} onChange={e => setTitle(e.target.value)} /></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={requiresActive} disabled={busy || uncertain} onChange={e => setRequiresActive(e.target.checked)} />活動中の講師だけに見せる</label>
      <button type="button" disabled={busy || !title.trim() || uncertain} onClick={create} className="min-h-11 rounded-lg bg-[var(--mikke-primary)] px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "準備中…" : "資料を下書きで作成"}</button>
      {uncertain ? <p className="text-sm">作成結果を確認してから再操作してください。マニュアルに戻ると一覧を再読み込みします。</p> : null}
    </>}
    {error ? <p role="alert" className="text-sm text-[var(--mikke-danger)]">{error}</p> : null}
  </section>;
}
