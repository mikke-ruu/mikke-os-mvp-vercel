"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Images, LoaderCircle, Trash2, Upload, X } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import {
  formatMediaBytes,
  deleteMikkeMediaAsset,
  getMikkeMediaUsage,
  listMikkeMediaAssets,
  uploadMikkeMediaImage
} from "@/lib/media/client";
import type { MikkeMediaAsset, MikkeMediaUsage } from "@/lib/media/types";

export function MikkeMediaPicker({ currentUrl, onSelect, sourceApp, compact = false }: {
  currentUrl?: string;
  onSelect: (asset: MikkeMediaAsset) => void;
  sourceApp: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [assets, setAssets] = useState<MikkeMediaAsset[]>([]);
  const [usage, setUsage] = useState<MikkeMediaUsage | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      const [nextAssets, nextUsage] = await Promise.all([listMikkeMediaAssets(), getMikkeMediaUsage()]);
      setAssets(nextAssets);
      setUsage(nextUsage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "画像ライブラリを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  async function chooseFile(file?: File) {
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const asset = await uploadMikkeMediaImage({ userId: user.id, file, sourceApp });
      onSelect(asset);
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      const nextUsage = await getMikkeMediaUsage();
      setUsage(nextUsage);
      setMessage("Mikke Mediaへ保存しました。別のアプリでも再利用できます。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "画像を保存できませんでした。");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeAsset(asset: MikkeMediaAsset) {
    if (!window.confirm(`「${asset.originalName}」をMikke Mediaから完全に削除しますか？`)) return;
    setDeletingId(asset.id);
    setMessage("");
    try {
      await deleteMikkeMediaAsset(asset);
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setUsage(await getMikkeMediaUsage());
      setMessage("画像を削除しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "画像を削除できませんでした。");
    } finally {
      setDeletingId(null);
    }
  }

  const percent = usage ? Math.min(100, Math.round((usage.usedBytes / usage.maxBytes) * 100)) : 0;

  return (
    <div className="rounded-xl border border-dashed border-[var(--mikke-primary-border)] bg-[var(--mikke-surface-soft)] p-3">
      <div className="flex flex-wrap items-center gap-3">
        {currentUrl ? <img src={currentUrl} alt="" className={`${compact ? "h-14 w-14" : "h-20 w-24"} rounded-lg object-cover`} /> : <span className={`${compact ? "h-14 w-14" : "h-20 w-24"} grid place-items-center rounded-lg bg-white text-[var(--mikke-muted)]`}><ImagePlus size={22} /></span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
              {uploading ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}
              {uploading ? "圧縮・保存中..." : "ファイルを追加"}
            </button>
            <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-primary-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]">
              <Images size={15} />以前の画像から選ぶ
            </button>
          </div>
          <p className="mt-1 text-[10px] leading-4 text-[var(--mikke-muted)]">URL入力不要。15MBまでの画像をWebP・長辺2000px・最大3MBへ自動調整します。</p>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void chooseFile(event.target.files?.[0])} />
      {message ? <p role="status" className="mt-2 text-xs font-bold text-[var(--mikke-accent)]">{message}</p> : null}

      {open ? <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Mikke Media画像ライブラリ" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <section className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-[var(--mikke-line-soft)] p-5">
            <div><p className="text-xs font-bold text-[var(--mikke-accent)]">mikkeOS共通</p><h2 className="mt-1 text-xl font-black text-[var(--mikke-ink)]">Mikke Media</h2><p className="mt-1 text-sm text-[var(--mikke-muted)]">一度保存した画像をPageや他のアプリで再利用できます。</p></div>
            <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]" aria-label="閉じる"><X size={18} /></button>
          </header>
          <div className="border-b border-[var(--mikke-line-soft)] p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-[220px] flex-1"><div className="mb-2 flex justify-between text-xs font-bold"><span>無料ストレージ</span><span>{usage ? `${formatMediaBytes(usage.usedBytes)} / ${formatMediaBytes(usage.maxBytes)}` : "確認中"}</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--mikke-surface-soft)]"><div className="h-full rounded-full bg-[var(--mikke-primary)]" style={{ width: `${percent}%` }} /></div></div>
              <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Upload size={15} />新しい画像を追加</button>
            </div>
          </div>
          <div className="max-h-[52vh] overflow-y-auto p-5">
            {loading ? <div className="grid min-h-44 place-items-center text-sm font-bold text-[var(--mikke-muted)]"><LoaderCircle className="animate-spin" /></div> : assets.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{assets.map((asset) => <article key={asset.id} className="relative overflow-hidden rounded-xl border border-[var(--mikke-line)] bg-white transition hover:border-[var(--mikke-primary)] hover:shadow-md"><button type="button" onClick={() => { onSelect(asset); setOpen(false); }} className="block w-full text-left"><img src={asset.publicUrl} alt={asset.originalName} loading="lazy" className="aspect-square w-full object-cover" /><span className="block truncate px-3 pt-2 text-xs font-bold text-[var(--mikke-ink)]">{asset.originalName}</span><span className="block px-3 pb-3 pt-1 text-[10px] text-[var(--mikke-muted)]">{formatMediaBytes(asset.byteSize)}・{asset.sourceApp}</span></button><button type="button" onClick={() => void removeAsset(asset)} disabled={deletingId === asset.id || currentUrl === asset.publicUrl} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-[var(--mikke-danger)] shadow disabled:opacity-35" aria-label={`${asset.originalName}を削除`}>{deletingId === asset.id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}</button></article>)}</div> : <div className="grid min-h-44 place-items-center rounded-xl bg-[var(--mikke-surface-soft)] p-6 text-center"><div><Images className="mx-auto text-[var(--mikke-muted)]" /><p className="mt-3 text-sm font-bold">保存済み画像はまだありません</p><p className="mt-1 text-xs text-[var(--mikke-muted)]">最初の画像を追加すると、ここから再利用できます。</p></div></div>}
            {message ? <p role="status" className="mt-4 text-xs font-bold text-[var(--mikke-accent)]">{message}</p> : null}
          </div>
        </section>
      </div> : null}
    </div>
  );
}
