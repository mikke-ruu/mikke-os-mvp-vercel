"use client";

import { Check, Copy, ExternalLink, QrCode, Share2, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { getMyStoryProfile } from "@/lib/mikkeos/story-profile-db";
import { getStoryAppPath, getStoryPublicUrl } from "@/lib/mikkeos/story-profile-store";
import { getExternalBrowserShareUrl } from "@/lib/mikkeos/share-targets";
import { supabase } from "@/lib/supabase/client";

export function StorySharePage() {
  const [shareUrl, setShareUrl] = useState("");
  const [previewPath, setPreviewPath] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyStoryProfile(supabase).then((story) => {
      if (cancelled || !story?.isPublished) return;
      const url = getStoryPublicUrl(story.handle);
      setShareUrl(url);
      setPreviewPath(getStoryAppPath(story.handle));
      return QRCode.toDataURL(getExternalBrowserShareUrl(url), { errorCorrectionLevel: "M", margin: 1, scale: 7 });
    }).then((url) => { if (!cancelled && url) setQrDataUrl(url); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(getExternalBrowserShareUrl(shareUrl));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const share = async () => {
    if (!navigator.share) return copy();
    try { await navigator.share({ title: "私のSTORY", text: "私のSTORYを見てください。", url: getExternalBrowserShareUrl(shareUrl) }); } catch { /* Share sheet was closed. */ }
  };

  if (loading) return <div className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</div>;
  if (!shareUrl) return <div className="mx-auto max-w-md rounded-xl border border-[var(--mikke-line)] bg-white p-6 text-center"><QrCode className="mx-auto text-[var(--mikke-blue)]" /><p className="mt-4 text-base font-medium">STORYを公開するとQRを使えます</p><p className="mt-2 text-sm font-normal leading-6 text-[var(--mikke-muted)]">編集画面で内容を確認し、「公開する」を押してください。</p></div>;

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-bold text-[var(--mikke-primary)]">私のSTORYを共有</p>
      <h1 className="mt-2 text-xl font-bold tracking-normal">私のSTORYを見てもらう</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">公開中のプロフィールを、名刺のように渡せます。</p>
      <div className="mx-auto mt-5 aspect-square w-full max-w-56 rounded-2xl border border-[var(--mikke-line)] bg-white p-3">
        {qrDataUrl ? <img src={qrDataUrl} alt="私のSTORY共有用QRコード" className="h-full w-full" /> : null}
      </div>
      <p className="mt-4 break-all rounded-xl bg-[var(--mikke-surface-soft)] p-3 text-xs leading-5 text-[var(--mikke-muted)]">{shareUrl}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void copy()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-3 text-sm font-bold">
          {copied ? <Check size={17} /> : <Copy size={17} />} {copied ? "コピー済み" : "URLコピー"}
        </button>
        <button type="button" onClick={() => void share()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--mikke-orange)] px-3 text-sm font-bold text-white">
          <Share2 size={17} /> 共有する
        </button>
      </div>
      <button type="button" onClick={() => setPreviewOpen(true)} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--mikke-accent-soft)] px-4 text-sm font-bold text-[var(--mikke-primary)]">
        相手に見える画面を確認 <ExternalLink size={15} />
      </button>
      <p className="mt-4 text-xs leading-5 text-[var(--mikke-muted)]">LINEで受け取った場合も、コピーせず通常のブラウザで開けるURLを共有します。</p>
      {previewOpen && previewPath ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label="相手に見えるSTORY画面">
          <header className="flex min-h-16 items-center justify-between border-b border-[var(--mikke-line)] bg-white px-4">
            <div>
              <p className="text-sm font-bold">相手に見える画面</p>
              <p className="mt-0.5 text-[11px] text-[var(--mikke-muted)]">確認後は「閉じる」でQR画面へ戻れます</p>
            </div>
            <button type="button" onClick={() => setPreviewOpen(false)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--mikke-primary)] px-4 text-sm font-bold text-white" aria-label="プレビューを閉じる">
              <X size={17} /> 閉じる
            </button>
          </header>
          <iframe src={previewPath} title="相手に見えるSTORY" className="min-h-0 flex-1 border-0 bg-[var(--mikke-surface-soft)]" />
        </div>
      ) : null}
    </section>
  );
}
