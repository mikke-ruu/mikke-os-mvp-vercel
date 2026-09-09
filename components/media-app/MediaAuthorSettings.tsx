"use client";
import { useMediaRepository } from "./MediaRepository";

import { useState } from "react";
import { MediaLink } from "./MediaNavigation";

import type { MediaSite } from "@/lib/media-app/types";

export function MediaAuthorSettings({ site }: { site: MediaSite }) {
  const {updateMediaAuthorProfile,cloud}=useMediaRepository();
  const [bio, setBio] = useState(site.authorBio ?? "");
  const [storyUrl, setStoryUrl] = useState(site.storyUrl ?? "");
  const [showStory, setShowStory] = useState(site.showStory === true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputClass = "mt-2 w-full rounded-xl border border-[var(--mikke-line)] bg-white p-3 text-sm font-normal";
  if(cloud) return <p className="mt-6 text-sm">STORYリンクと追加プロフィールのクラウド保存は準備中です。</p>;
  return <section className="mt-8 border-t border-[var(--mikke-line)] py-7">
    <h2 className="text-xl font-bold">書き手のプロフィール</h2>
    <p className="mt-2 text-sm leading-7 text-[var(--mikke-muted)]">記事の下に自己紹介とSTORYへのリンクを添えられます。匿名やブランド名のMediaでは設定しなくても大丈夫です。</p>
    <form className="mt-5 space-y-5" onSubmit={async (event) => {
      event.preventDefault(); setMessage(""); setError("");
      try {
        const next = await updateMediaAuthorProfile(site.id, { authorBio: bio, storyUrl, showStory });
        setStoryUrl(next.storyUrl); setMessage("プロフィールを保存しました。読者画面で確認できます。");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "保存できませんでした。"); }
    }}>
      <label className="block text-sm font-bold">自己紹介（任意）<textarea rows={4} value={bio} onChange={(event) => setBio(event.target.value)} className={inputClass} placeholder="どんなことを書いている人か、読者にひとこと。" /><span className="mt-1 block text-xs font-normal text-[var(--mikke-muted)]">500文字まで。アカウントの基本情報は変更されません。</span></label>
      <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={showStory} onChange={(event) => setShowStory(event.target.checked)} />プロフィールにSTORYへのリンクを表示する</label>
      <label className="block text-sm font-bold">公開STORYのURL（任意）<input type="url" value={storyUrl} onChange={(event) => setStoryUrl(event.target.value)} className={inputClass} placeholder="https://mikke-os.com/story/…" /><span className="mt-1 block text-xs font-normal leading-6 text-[var(--mikke-muted)]">STORYの公開ページのURLを貼り付けます。名前や写真は自動で取り込みません。</span></label>
      {error ? <p role="alert" className="text-sm">{error}</p> : null}
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      <button type="submit" className="rounded-xl bg-[var(--mikke-accent)] px-5 py-3 text-sm font-bold text-white" style={{ backgroundColor: "var(--mikke-orange, #f75a3b)" }}>プロフィールを保存</button>
    </form>
    <div className="mt-8 border-t border-[var(--mikke-line)] pt-6"><h3 className="font-bold">他のアプリに記事を載せる</h3><p className="mt-2 text-sm leading-7 text-[var(--mikke-muted)]">STORY・Page・Academyへ選んだ記事を掲載する機能は準備中です。この設定だけで記事が他のアプリに公開されることはありません。</p><MediaLink href="/apps/media/connections" className="mt-4 inline-block text-sm font-bold text-[var(--mikke-primary)] underline">記事連携の動作見本を見る</MediaLink></div>
  </section>;
}
