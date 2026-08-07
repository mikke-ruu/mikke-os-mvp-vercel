"use client";

import { Copy, QrCode, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { getMyStoryProfile } from "@/lib/mikkeos/story-profile-db";
import { getStoryPublicUrl } from "@/lib/mikkeos/story-profile-store";
import { supabase } from "@/lib/supabase/client";

export function StorySharePage() {
  const [shareUrl, setShareUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMyStoryProfile(supabase).then((story) => {
      if (cancelled || !story?.isPublished) return;
      const url = getStoryPublicUrl(story.handle);
      setShareUrl(url);
      return QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, scale: 7 });
    }).then((url) => { if (!cancelled && url) setQrDataUrl(url); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const share = async () => {
    if (!navigator.share) return copy();
    try { await navigator.share({ title: "私のSTORY", url: shareUrl }); } catch { /* Share sheet was closed. */ }
  };

  if (loading) return <div className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</div>;
  if (!shareUrl) return <div className="mx-auto max-w-md rounded-xl border border-[var(--mikke-line)] bg-white p-6 text-center"><QrCode className="mx-auto text-[var(--mikke-blue)]" /><p className="mt-4 text-base font-medium">STORYを公開するとQRを使えます</p><p className="mt-2 text-sm font-normal leading-6 text-[var(--mikke-muted)]">編集画面で内容を確認し、「公開する」を押してください。</p></div>;

  return <section className="mx-auto max-w-md rounded-xl border border-[var(--mikke-line)] bg-white p-5 sm:p-6"><div className="mx-auto w-52 rounded-xl border border-[var(--mikke-line)] bg-white p-3">{qrDataUrl ? <img src={qrDataUrl} alt="STORY共有用QRコード" className="h-full w-full" /> : null}</div><p className="mt-5 break-all text-center text-xs font-normal text-[var(--mikke-muted)]">{shareUrl.replace(/^https?:\/\//, "")}</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => void copy()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--mikke-line)] px-4 py-3 text-sm font-medium"><Copy size={16} />{copied ? "コピー済み" : "コピー"}</button><button type="button" onClick={() => void share()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--mikke-blue)] px-4 py-3 text-sm font-medium text-white"><Share2 size={16} />共有</button></div><p className="mt-4 text-xs font-normal leading-5 text-[var(--mikke-muted)]">このQRを読み取ると、ログインせずに公開STORYを閲覧できます。</p></section>;
}
