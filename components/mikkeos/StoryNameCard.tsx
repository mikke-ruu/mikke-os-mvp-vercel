"use client";

import { Copy, ExternalLink, MapPin, Pencil, Share2 } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { getStoryPublicUrl, type StoryProfileView } from "@/lib/mikkeos/story-profile-store";

export function StoryNameCard({ story, isOwner = false }: { story: StoryProfileView; isOwner?: boolean }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const displayName = story.displayName.trim();
  const shareUrl = story.handle ? getStoryPublicUrl(story.handle) : "";
  const initials = displayName ? displayName.slice(0, 2) : "ST";
  const externalLinks = [
    { label: "Web Site", url: story.websiteUrl },
    { label: "Shop", url: story.shopUrl },
    ...story.sns.map((item) => ({ label: item.label, url: item.url }))
  ].filter((item) => item.label.trim() && item.url.trim());

  useEffect(() => {
    let cancelled = false;
    if (!shareUrl) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(shareUrl, { errorCorrectionLevel: "M", margin: 1, scale: 6 })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(""); });
    return () => { cancelled = true; };
  }, [shareUrl]);

  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const share = async () => {
    if (!shareUrl) return;
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title: `${displayName} | STORY`, text: `${displayName}のSTORYです。`, url: shareUrl });
    } catch {
      // Closing the native share sheet is not an error for the page.
    }
  };

  if (!displayName || !story.handle) {
    return (
      <main className="grid min-h-screen place-items-center bg-white px-4 text-center text-[var(--mikke-text)]">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--mikke-line)] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mikke-primary)]">STORY</p>
          <h1 className="mt-3 text-xl font-bold">公開名刺をつくりましょう</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">表示名とURL名を決めて、公開前に内容を確認できます。</p>
          <Link href="/story/start" className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white">初期設定を始める</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--mikke-surface-soft)] px-0 py-0 text-[var(--mikke-text)] sm:px-5 sm:py-8">
      <article className="mx-auto min-h-screen w-full max-w-[430px] overflow-hidden bg-white sm:min-h-0 sm:rounded-[28px] sm:border sm:border-[var(--mikke-line)] sm:shadow-sm">
        <header className="flex items-center justify-between border-b border-[var(--mikke-line-soft)] px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mikke-primary)]">STORY</p>
            {isOwner ? <p className="mt-1 text-[11px] font-bold text-[var(--mikke-muted)]">{story.isPublished ? "公開中" : "未公開・下書き"}</p> : null}
          </div>
          {isOwner ? <Link href="/story/edit" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold"><Pencil size={14} />編集</Link> : null}
        </header>

        <section className="px-4 pb-6 pt-7 text-center">
          <div className="relative mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-[var(--mikke-pink)] text-xl font-extrabold">
            <span>{initials}</span>
            {story.avatarUrl ? <img src={story.avatarUrl} alt={`${displayName}のプロフィール画像`} className="absolute inset-0 h-full w-full object-cover" /> : null}
          </div>
          {story.role ? <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-[var(--mikke-primary)]">{story.role}</p> : null}
          <h1 className="mt-1 text-2xl font-bold leading-tight">{displayName}</h1>
          {story.bio ? <p className="mx-auto mt-4 max-w-sm whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-muted)]">{story.bio}</p> : null}
          {story.area ? <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--mikke-muted)]"><MapPin size={13} />{story.area}</p> : null}
          {story.status ? <p className="mx-auto mt-3 w-fit rounded-full bg-[var(--mikke-pink)] px-3 py-1.5 text-xs font-bold">{story.status}</p> : null}
          {story.tags.length ? <div className="mt-3 flex flex-wrap justify-center gap-1.5">{story.tags.map((tag) => <span key={tag} className="rounded-lg border border-[var(--mikke-line)] px-2.5 py-1 text-[11px] font-semibold">{tag}</span>)}</div> : null}
        </section>

        {story.pickupText ? <section className="border-t border-[var(--mikke-line-soft)] px-4 py-5"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--mikke-primary)]">PICK UP</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7">{story.pickupText}</p></section> : null}

        {externalLinks.length ? <section className="border-t border-[var(--mikke-line-soft)] px-4 py-5"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--mikke-primary)]">LINKS</p><div className="mt-3 grid gap-2">{externalLinks.map((item) => <Link key={`${item.label}-${item.url}`} href={item.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--mikke-line)] px-4 py-3 text-sm font-bold"><span className="truncate">{item.label}</span><ExternalLink size={15} /></Link>)}</div></section> : null}

        {isOwner ? <section className="border-t border-[var(--mikke-line-soft)] px-4 py-4"><p className="rounded-xl bg-[var(--mikke-surface-soft)] px-4 py-3 text-xs leading-5 text-[var(--mikke-muted)]">活動実績は初回リリースでは掲載しません。本人が公開対象を選び、保存できる機能が整ってから追加します。</p></section> : null}

        {shareUrl ? <section className="border-t border-[var(--mikke-line-soft)] px-4 py-5"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--mikke-primary)]">NAME CARD</p><div className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--mikke-line)] p-3"><div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-white p-1">{qrDataUrl ? <img src={qrDataUrl} alt="STORY共有用QRコード" className="h-full w-full" /> : <span className="text-[10px] text-[var(--mikke-muted)]">QR生成中</span>}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{shareUrl.replace(/^https?:\/\//, "")}</p><div className="mt-3 flex gap-2"><button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold"><Copy size={14} />{copied ? "コピー済み" : "コピー"}</button><button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white"><Share2 size={14} />共有</button></div></div></div></section> : null}

        <footer className="border-t border-[var(--mikke-line-soft)] py-4 text-center text-xs font-semibold text-[var(--mikke-muted-light)]">Story by mikke</footer>
      </article>
    </main>
  );
}
