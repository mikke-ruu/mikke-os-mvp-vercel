"use client";
import { useRef, useState } from "react";

export function MediaLocalImagePicker({ currentUrl, cover, onSelect, compact, onRemove, removeLabel="画像を外す" }: { currentUrl?: string; cover?: boolean; compact?:boolean; removeLabel?:string; onRemove?:()=>void; onSelect: (asset: { id: string; publicUrl: string; originalName: string }) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function choose(file?: File) {
    if (!file || busy) return;
    setBusy(true); setError("");
    try {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) throw Error("15MB以下のJPG・PNG・WebPを選んでください。");
      const bitmap = await createImageBitmap(file);
      let url = "";
      try {
        const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d"); if (!context) throw Error("画像を読み込めませんでした。");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        for (const quality of [.8, .65, .5]) { url = canvas.toDataURL("image/webp", quality); if (url.length < 650000) break; }
        if (url.length >= 650000) throw Error("この画像は保存サイズが大きいため、小さい画像を選んでください。");
      } finally { bitmap.close(); }
      onSelect({ id: `local_${crypto.randomUUID()}`, publicUrl: url, originalName: file.name });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "画像を読み込めませんでした。"); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  return <div className={compact?"flex flex-wrap items-center gap-2":"p-4"}>{currentUrl ? <img src={currentUrl} alt="選択した画像" className={cover ? "mb-4 aspect-[1280/670] w-full rounded-xl object-cover" : "mb-4 max-h-[480px] w-full rounded-xl object-contain"} /> : null}<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => void choose(event.target.files?.[0])} /><button type="button" disabled={busy} onClick={() => input.current?.click()} className={compact?"rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white":"rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white"}>{busy ? "画像を読み込んでいます…" : "画像を選ぶ"}</button>{onRemove?<button type="button" disabled={busy} onClick={onRemove} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs">{removeLabel}</button>:null}{error ? <p role="alert" className="mt-3 text-sm">{error}</p> : null}</div>;
}
