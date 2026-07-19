"use client";

import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Upload } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { uploadPageAsset } from "@/lib/page/assets";
import type { PageAssetRef } from "@/lib/page/types";

export function PageImageUploader({ siteId, currentUrl, onUploaded, compact = false }: {
  siteId: string;
  currentUrl?: string;
  onUploaded: (asset: PageAssetRef) => void;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function choose(file?: File) {
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const asset = await uploadPageAsset({ userId: user.id, siteId, file });
      onUploaded(asset);
      setMessage("画像を保存しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "画像を保存できませんでした。");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-[var(--mikke-primary-border)] bg-[var(--mikke-surface-soft)] p-3">
      <div className="flex flex-wrap items-center gap-3">
        {currentUrl ? <img src={currentUrl} alt="" className={`${compact ? "h-14 w-14" : "h-20 w-24"} rounded-lg object-cover`} /> : <span className={`${compact ? "h-14 w-14" : "h-20 w-24"} grid place-items-center rounded-lg bg-white text-[var(--mikke-muted)]`}><ImagePlus size={22} /></span>}
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            {uploading ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}
            {uploading ? "縮小・保存中..." : currentUrl ? "画像を差し替える" : "ファイルから画像を選ぶ"}
          </button>
          <p className="mt-1 text-[10px] leading-4 text-[var(--mikke-muted)]">JPG・PNG・WebP / 最大10MB。長辺2400pxまでに自動調整します。</p>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void choose(event.target.files?.[0])} />
      {message ? <p role="status" className="mt-2 text-xs font-bold text-[var(--mikke-accent)]">{message}</p> : null}
    </div>
  );
}
