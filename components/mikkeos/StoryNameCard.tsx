"use client";

import { ChevronLeft, ChevronRight, ExternalLink, Instagram, MapPin, MessageCircle, Music2, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { getSafeStoryLinkUrl, getStoryAppPath, storySnsDefaults, storyThemes, type StoryProfileView } from "@/lib/mikkeos/story-profile-store";

export function StoryNameCard({
  story,
  isOwner = false,
  preview = false,
  collectionAction
}: {
  story: StoryProfileView;
  isOwner?: boolean;
  preview?: boolean;
  collectionAction?: ReactNode;
}) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const displayName = story.displayName.trim() || (preview ? "表示名" : "");
  const handle = story.handle.trim();
  const initials = displayName === "表示名" ? "ST" : displayName.slice(0, 2) || "ST";
  const theme = storyThemes[story.themeKey] ?? storyThemes.blue;
  const snsLinks = story.sns
    .map((item) => ({ ...item, url: getSafeStoryLinkUrl(item.url) }))
    .filter((item) => storySnsDefaults.some((fixed) => fixed.key === item.key) && item.url);
  const otherLinks = [
    { key: "website", label: story.websiteLabel || "Webサイト", url: story.websiteUrl },
    { key: "shop", label: story.shopLabel || "ショップ", url: story.shopUrl },
    ...story.sns.filter((item) => item.key.startsWith("custom-"))
  ]
    .map((item) => ({ ...item, url: getSafeStoryLinkUrl(item.url) }))
    .filter((item) => item.label.trim() && item.url);

  useEffect(() => {
    if (selectedPhotoIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPhotoIndex(null);
      if (event.key === "ArrowLeft") setSelectedPhotoIndex((current) => current === null ? null : (current - 1 + story.portfolio.length) % story.portfolio.length);
      if (event.key === "ArrowRight") setSelectedPhotoIndex((current) => current === null ? null : (current + 1) % story.portfolio.length);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedPhotoIndex, story.portfolio.length]);

  if (!displayName || !handle) return <EmptyStory />;

  return (
    <div
      className="w-full text-[#1b1b1f]"
      style={{ "--story-accent": theme.accent, "--story-soft": theme.soft, "--story-ink": theme.ink } as React.CSSProperties}
    >
      <article className="mx-auto w-full max-w-[430px] overflow-hidden rounded-[24px] border border-black/10 bg-white">
        <header className="flex items-center justify-between px-5 py-3.5">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[var(--story-accent)]">STORY</p>
            {isOwner ? <p className="mt-1 text-[10px] font-medium text-black/40">{story.isPublished ? "公開中" : "未公開・下書き"}</p> : null}
          </div>
          {isOwner ? <div className="flex items-center gap-2"><Link href={getStoryAppPath(story.handle)} aria-label="公開ページを見る" className="grid h-9 w-9 place-items-center rounded-full border border-black/10"><ExternalLink size={14} /></Link><Link href="/story/edit" className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-2 text-xs font-medium"><Pencil size={14} />編集</Link></div> : null}
        </header>

        <section className="relative">
          <div className="h-36 overflow-hidden" style={{ background: story.bannerUrl ? undefined : theme.accent }}>
            {story.bannerUrl ? <img src={story.bannerUrl} alt="プロフィールバナー" decoding="async" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="relative px-5 pb-6">
            <div className="absolute -top-12 left-5 h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-[var(--story-soft)]">
              <div className="grid h-full w-full place-items-center text-xl font-semibold text-[var(--story-ink)]">{initials}</div>
              {story.avatarUrl ? <img src={story.avatarUrl} alt={`${displayName}さんのプロフィール写真`} decoding="async" className="absolute inset-0 h-full w-full object-cover" /> : null}
            </div>
            <div className="pt-16">
              <h1 className="text-[26px] font-semibold leading-tight">{displayName}</h1>
              {story.role ? <p className="mt-1 text-sm font-medium text-[var(--story-accent)]">{story.role}</p> : null}
              {story.bio ? <p className="mt-4 whitespace-pre-wrap text-sm font-normal leading-7 text-black/65">{story.bio}</p> : null}
              {story.area ? <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-normal text-black/45"><MapPin size={13} />{story.area}</p> : null}
              {story.status ? <p className="mt-4 w-fit rounded-full bg-[var(--story-soft)] px-3 py-2 text-xs font-medium text-[var(--story-ink)]">{story.status}</p> : null}
            </div>
          </div>
        </section>

        {story.portfolio.length ? (
          <section aria-label="写真" className="border-t border-black/5 px-5 py-6">
            <div className="grid grid-cols-3 gap-2">
              {story.portfolio.map((item, index) => (
                <figure key={item.id} className={`overflow-hidden rounded-xl bg-black/5 ${photoItemClass(story.portfolio.length, index)}`}>
                  <button type="button" onClick={() => setSelectedPhotoIndex(index)} aria-label={`${item.caption || `写真 ${index + 1}`}を拡大`} className="block h-full w-full cursor-zoom-in">
                    <img src={item.imageUrl} alt={item.caption || `写真 ${index + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </button>
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        {story.pickupText ? <section className="border-t border-black/5 px-5 py-6"><p className="whitespace-pre-wrap text-sm font-normal leading-7 text-black/65">{story.pickupText}</p></section> : null}

        {story.tags.length ? <section className="border-t border-black/5 px-5 py-5"><div className="flex flex-wrap gap-2">{story.tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--story-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--story-ink)]">#{tag}</span>)}</div></section> : null}

        {(snsLinks.length || otherLinks.length) ? (
          <section className="border-t border-black/5 px-5 py-6">
            {snsLinks.length ? <div className="flex flex-wrap gap-2.5">{snsLinks.map((item) => <Link key={item.key} href={item.url} target="_blank" rel="noreferrer" aria-label={item.label} title={item.label} className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white">{socialIcon(item.key)}</Link>)}</div> : null}
            {otherLinks.length ? <div className={`${snsLinks.length ? "mt-4" : ""} grid gap-2`}>{otherLinks.map((item) => <Link key={`${item.key}-${item.url}`} href={item.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-black/10 px-4 py-3 text-sm font-medium"><span className="truncate">{item.label}</span><ExternalLink size={15} className="text-black/35" /></Link>)}</div> : null}
          </section>
        ) : null}

        {collectionAction ? <section className="border-t border-black/5 px-5 py-6">{collectionAction}</section> : null}

        <footer className="border-t border-black/5 py-5 text-center text-[11px] font-normal tracking-[0.08em] text-black/30">STORY <span className="tracking-normal">by mikke</span></footer>
      </article>

      {selectedPhotoIndex !== null && story.portfolio[selectedPhotoIndex] ? (
        <div role="dialog" aria-modal="true" aria-label="写真を拡大表示" onClick={() => setSelectedPhotoIndex(null)} className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 px-3 py-16 text-white">
          <button type="button" onClick={() => setSelectedPhotoIndex(null)} aria-label="閉じる" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 backdrop-blur"><X size={22} /></button>
          {story.portfolio.length > 1 ? <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedPhotoIndex((selectedPhotoIndex - 1 + story.portfolio.length) % story.portfolio.length); }} aria-label="前の写真" className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 backdrop-blur"><ChevronLeft size={26} /></button> : null}
          <figure onClick={(event) => event.stopPropagation()} className="flex max-h-full w-full max-w-5xl flex-col items-center justify-center">
            <img src={story.portfolio[selectedPhotoIndex].imageUrl} alt={story.portfolio[selectedPhotoIndex].caption || `写真 ${selectedPhotoIndex + 1}`} className="max-h-[75vh] max-w-full rounded-lg object-contain" />
            <figcaption className="mt-4 text-center text-sm font-normal text-white/80">{story.portfolio[selectedPhotoIndex].caption ? `${story.portfolio[selectedPhotoIndex].caption} ・ ` : ""}{selectedPhotoIndex + 1} / {story.portfolio.length}</figcaption>
          </figure>
          {story.portfolio.length > 1 ? <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedPhotoIndex((selectedPhotoIndex + 1) % story.portfolio.length); }} aria-label="次の写真" className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 backdrop-blur"><ChevronRight size={26} /></button> : null}
        </div>
      ) : null}
    </div>
  );
}

function photoItemClass(count: number, index: number) {
  if (count === 6) {
    if (index === 0) return "col-start-1 col-span-2 row-start-1 row-span-2 aspect-square";
    if (index === 1) return "col-start-3 row-start-1 aspect-square";
    if (index === 2) return "col-start-3 row-start-2 aspect-square";
    if (index === 3) return "col-start-1 row-start-3 aspect-square";
    if (index === 4) return "col-start-1 row-start-4 aspect-square";
    return "col-start-2 col-span-2 row-start-3 row-span-2 aspect-square";
  }
  return index === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square";
}

function socialIcon(key: string) {
  if (key === "line") return <MessageCircle size={21} strokeWidth={2} color="#06c755" />;
  if (key === "instagram") return <Instagram size={21} strokeWidth={2} color="#d62976" />;
  if (key === "facebook") return <span className="text-xl font-semibold text-[#1877f2]">f</span>;
  if (key === "tiktok") return <Music2 size={21} strokeWidth={2} color="#25f4ee" className="drop-shadow-[1px_1px_0_#fe2c55]" />;
  return <span className="text-base font-medium text-[#1b1b1f]">X</span>;
}

function EmptyStory() {
  return <div className="mx-auto w-full max-w-[430px] rounded-[24px] border border-black/10 bg-white p-6 text-center"><p className="text-xs font-semibold tracking-[0.2em] text-[var(--mikke-blue)]">STORY</p><h1 className="mt-3 text-xl font-semibold">あなたの公開名刺をつくりましょう</h1><p className="mt-2 text-sm font-normal leading-6 text-black/50">写真や自己紹介、リンクを一枚にまとめられます。</p><Link href="/story/start" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--mikke-blue)] px-4 py-3 text-sm font-medium text-white">STORYをつくる</Link></div>;
}
