"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { privateMaterialUiEnabled } from "@/lib/academy/private-material-ui";
import { ACADEMY_PRIVATE_PDF_MAX_BYTES, type AcademyPrivateMaterialAsset, type AcademyPrivateMaterialParent } from "@/lib/academy/private-material-contract";
import { downloadPrivateMaterial, listPrivateMaterials, uploadPrivateMaterial } from "@/lib/academy/private-material-client";

export function PrivateMaterialFiles({ parent, editable = false }: { parent: AcademyPrivateMaterialParent; editable?: boolean }) {
  const { profile } = useAuth();
  if (!privateMaterialUiEnabled) return null;
  return <Files key={`${profile.user_id}:${parent.audience}:${parent.parentId}`} parent={parent} editable={editable} userId={profile.user_id} />;
}
function Files({ parent, editable, userId }: { parent: AcademyPrivateMaterialParent; editable: boolean; userId: string }) {
  const [assets, setAssets] = useState<AcademyPrivateMaterialAsset[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function refresh() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { const list = await listPrivateMaterials(parent, userId); if (alive.current) { setAssets(list); setLoaded(true); setUncertain(false); } }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "資料一覧を確認できませんでした。"); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function upload() {
    if (!file || lock.current || uncertain) return;
    if (!/\.pdf$/i.test(file.name) || file.size === 0 || file.size > ACADEMY_PRIVATE_PDF_MAX_BYTES) { setError("PDF（3MB以下）を選択してください。"); return; }
    lock.current = true; setBusy(true); setError("");
    try { const asset = await uploadPrivateMaterial(parent, file, userId); if (alive.current) { setAssets(previous => [asset, ...previous]); setFile(null); } }
    catch (e) { if (alive.current) { setError(e instanceof Error ? e.message : "送信できませんでした。"); setUncertain(true); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function download(asset: AcademyPrivateMaterialAsset) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await downloadPrivateMaterial(asset, userId); }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "資料を取得できませんでした。"); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <div className="space-y-3 py-3">
    <button type="button" disabled={busy} onClick={refresh} className="min-h-11 text-sm font-bold text-[var(--mikke-primary)]">{busy ? "処理中…" : loaded ? "PDF一覧を再確認" : "PDF一覧を確認"}</button>
    {assets.length > 0 ? <ul className="space-y-2">{assets.map(asset => <li key={asset.id}><button type="button" disabled={busy} onClick={() => download(asset)} className="min-h-11 break-words text-left text-sm text-[var(--mikke-primary)]">{asset.originalName} をダウンロード</button></li>)}</ul> : loaded ? <p className="text-sm text-[var(--mikke-muted)]">登録されたPDFはありません。</p> : null}
    {editable ? <div className="space-y-2">
      <label className="block text-sm">PDFを選択（3MB以下）<input key={file ? "selected" : "empty"} type="file" accept="application/pdf,.pdf" disabled={busy} className="mt-2 block max-w-full text-sm" onChange={e => { setFile(e.target.files?.[0] ?? null); setError(""); }} /></label>
      {file ? <p className="break-words text-xs">選択中：{file.name}</p> : null}
      <button type="button" disabled={busy || !file || uncertain} onClick={upload} className="min-h-11 rounded-lg bg-[var(--mikke-primary)] px-4 py-2 text-sm text-white disabled:opacity-50">PDFをアップロード</button>
      {uncertain ? <p className="text-sm">重複送信を避けるため、まず「PDF一覧を再確認」で送信結果をご確認ください。</p> : null}
    </div> : null}
    {error ? <p role="alert" className="text-sm text-[var(--mikke-danger)]">{error}</p> : null}
  </div>;
}
