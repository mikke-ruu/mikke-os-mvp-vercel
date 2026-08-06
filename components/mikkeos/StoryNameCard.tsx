"use client";

import { Copy, ExternalLink, MapPin, Pencil, Share2 } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { getSafeStoryLinkUrl, getStoryPublicUrl, storySnsDefaults, storyThemes, type StoryProfileView } from "@/lib/mikkeos/story-profile-store";

const snsMarks: Record<string, string> = { line: "LINE", instagram: "◎", x: "X", facebook: "f", tiktok: "♪" };

export function StoryNameCard({ story, isOwner = false }: { story: StoryProfileView; isOwner?: boolean }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const displayName = story.displayName.trim();
  const shareUrl = story.handle ? getStoryPublicUrl(story.handle) : "";
  const initials = displayName.slice(0, 2) || "ST";
  const theme = storyThemes[story.themeKey] ?? storyThemes.indigo;
  const snsLinks = story.sns.map((item) => ({ ...item, url: getSafeStoryLinkUrl(item.url) })).filter((item) => storySnsDefaults.some((fixed) => fixed.key === item.key) && item.url);
  const otherLinks = [
    { key: "website", label: "Webサイト", url: story.websiteUrl },
    { key: "shop", label: "ショップ", url: story.shopUrl },
    ...story.sns.filter((item) => item.key.startsWith("custom-"))
  ].map((item) => ({ ...item, url: getSafeStoryLinkUrl(item.url) })).filter((item) => item.label.trim() && item.url);

  useEffect(() => {
    let cancelled = false;
    if (!shareUrl) { setQrDataUrl(""); return; }
    QRCode.toDataURL(shareUrl, { errorCorrectionLevel: "M", margin: 1, scale: 6 }).then((url) => { if (!cancelled) setQrDataUrl(url); }).catch(() => { if (!cancelled) setQrDataUrl(""); });
    return () => { cancelled = true; };
  }, [shareUrl]);

  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1600);
  };
  const share = async () => {
    if (!shareUrl) return;
    if (!navigator.share) return copy();
    try { await navigator.share({ title: `${displayName} | STORY`, text: `${displayName}さんのSTORYです。`, url: shareUrl }); } catch { /* Native share was closed. */ }
  };

  if (!displayName || !story.handle) return <EmptyStory />;

  return (
    <main className="min-h-screen bg-[#f4f5f8] text-[#171821] sm:px-5 sm:py-8" style={{ "--story-accent": theme.accent, "--story-soft": theme.soft, "--story-ink": theme.ink } as React.CSSProperties}>
      <article className="mx-auto min-h-screen w-full max-w-[430px] overflow-hidden bg-white sm:min-h-0 sm:rounded-[28px] sm:border sm:border-black/10 sm:shadow-sm">
        <header className="flex items-center justify-between px-5 py-3.5"><div><p className="text-xs font-extrabold tracking-[0.22em] text-[var(--story-accent)]">STORY</p>{isOwner ? <p className="mt-1 text-[10px] font-bold text-black/40">{story.isPublished ? "公開中" : "未公開・下書き"}</p> : null}</div>{isOwner ? <Link href="/story/edit" className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-2 text-xs font-bold"><Pencil size={14} />編集</Link> : null}</header>

        <section className="relative">
          <div className="h-36 overflow-hidden bg-[var(--story-soft)]">{story.bannerUrl ? <img src={story.bannerUrl} alt="プロフィールバナー" className="h-full w-full object-cover" /> : <div className="h-full w-full" />}</div>
          <div className="relative px-5 pb-6">
            <div className="absolute -top-12 left-5 h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-[var(--story-soft)] shadow-sm"><div className="grid h-full w-full place-items-center text-xl font-extrabold text-[var(--story-ink)]">{initials}</div>{story.avatarUrl ? <img src={story.avatarUrl} alt={`${displayName}さんのプロフィール写真`} className="absolute inset-0 h-full w-full object-cover" /> : null}</div>
            <div className="pt-16"><h1 className="text-[26px] font-extrabold leading-tight">{displayName}</h1>{story.role ? <p className="mt-1 text-sm font-bold text-[var(--story-accent)]">{story.role}</p> : null}{story.bio ? <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-black/65">{story.bio}</p> : null}{story.area ? <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-black/45"><MapPin size={13} />{story.area}</p> : null}{story.status ? <p className="mt-4 w-fit rounded-full bg-[var(--story-soft)] px-3 py-2 text-xs font-bold text-[var(--story-ink)]">{story.status}</p> : null}</div>
          </div>
        </section>

        {story.portfolio.length ? <section aria-label="写真" className="border-t border-black/5 px-5 py-6"><div className="grid grid-cols-3 gap-2">{story.portfolio.map((item, index) => <figure key={item.id} className={`overflow-hidden rounded-2xl bg-black/5 ${index === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`}><img src={item.imageUrl} alt={item.caption || `写真 ${index + 1}`} className="h-full w-full object-cover" /></figure>)}</div></section> : null}

        {story.pickupText ? <section className="border-t border-black/5 px-5 py-6"><SectionTitle eyebrow="PICK UP" title="いま伝えたいこと" /><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-black/65">{story.pickupText}</p></section> : null}

        {story.tags.length ? <section className="border-t border-black/5 px-5 py-5"><div className="flex flex-wrap gap-2">{story.tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--story-soft)] px-3 py-1.5 text-[11px] font-bold text-[var(--story-ink)]">#{tag}</span>)}</div></section> : null}

        {(snsLinks.length || otherLinks.length) ? <section className="border-t border-black/5 px-5 py-6"><SectionTitle eyebrow="LINKS" title="つながる" />{snsLinks.length ? <div className="mt-4 flex flex-wrap gap-2.5">{snsLinks.map((item) => <Link key={item.key} href={item.url} target="_blank" rel="noreferrer" aria-label={item.label} title={item.label} className="grid h-11 min-w-11 place-items-center rounded-full bg-[var(--story-ink)] px-2 text-xs font-extrabold text-white">{snsMarks[item.key] ?? item.label.slice(0, 2)}</Link>)}</div> : null}{otherLinks.length ? <div className="mt-4 grid gap-2">{otherLinks.map((item) => <Link key={`${item.key}-${item.url}`} href={item.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-black/10 px-4 py-3 text-sm font-bold"><span className="truncate">{item.label}</span><ExternalLink size={15} className="text-black/35" /></Link>)}</div> : null}</section> : null}

        {shareUrl ? <section className="border-t border-black/5 px-5 py-6"><SectionTitle eyebrow="NAME CARD" title="このSTORYを渡す" /><div className="mt-4 flex items-center gap-4 rounded-[22px] bg-[var(--story-soft)] p-4"><div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-white p-2 shadow-sm">{qrDataUrl ? <img src={qrDataUrl} alt="STORY共有用QRコード" className="h-full w-full" /> : <span className="text-[10px] text-black/35">QR生成中</span>}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[var(--story-ink)]">{shareUrl.replace(/^https?:\/\//, "")}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-bold"><Copy size={14} />{copied ? "コピー済み" : "コピー"}</button><button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--story-accent)] px-3 py-2 text-xs font-bold text-white"><Share2 size={14} />共有</button></div></div></div></section> : null}

        <footer className="border-t border-black/5 py-5 text-center text-[11px] font-semibold tracking-[0.08em] text-black/30">STORY <span className="font-normal tracking-normal">by mikke</span></footer>
      </article>
    </main>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="text-[10px] font-extrabold tracking-[0.18em] text-[var(--story-accent)]">{eyebrow}</p><h2 className="mt-1 text-lg font-extrabold">{title}</h2></div>;
}

function EmptyStory() {
  return <main className="grid min-h-screen place-items-center bg-white px-4 text-center"><div className="w-full max-w-sm rounded-[24px] border border-black/10 p-6"><p className="text-xs font-extrabold tracking-[0.2em] text-[#4656c7]">STORY</p><h1 className="mt-3 text-xl font-extrabold">あなたの公開名刺をつくりましょう</h1><p className="mt-2 text-sm leading-6 text-black/50">完成形を見ながら、写真・名前・活動内容を整えられます。</p><Link href="/story/start" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#4656c7] px-4 py-3 text-sm font-bold text-white">STORYをつくる</Link></div></main>;
}
