"use client";
import type { ComponentType } from "react";
import type { AcademyFrontDesign } from "@/lib/academy/front-design";
import { AcademyImageUploader } from "./AcademyImageUploader";
import { AcademyFrontHero } from "./AcademyFrontHero";

export function AcademyFrontDesignEditor({ design, onChange, title, message, imageUrl, ImagePicker = AcademyImageUploader }: {
  design: AcademyFrontDesign; onChange: (design: AcademyFrontDesign) => void;
  ImagePicker?: ComponentType<{ currentUrl?: string; onUploaded: (url: string) => void }>;
  title: string; message: string; imageUrl: string;
}) {
  const control = "min-h-11 rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2";
  return <section className="space-y-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5">
    <h2 className="font-bold">ホームページの見た目</h2>
    <div className="flex flex-wrap gap-6">
      <label className="grid gap-2">公開ページの幅<select className={control} value={design.width} onChange={event => onChange({ ...design, width: event.target.value as AcademyFrontDesign["width"] })}><option value="standard">標準</option><option value="wide">広め（最大1440px）</option><option value="full">画面幅いっぱい</option></select></label>
      <label className="grid gap-2">ヒーローの表示<select className={control} value={design.hero} onChange={event => onChange({ ...design, hero: event.target.value as AcademyFrontDesign["hero"] })}><option value="split">文章と画像を横に並べる</option><option value="stack">画像の下に文章を置く</option><option value="slides">画像スライドの下に文章を置く</option><option value="hidden">表示しない</option></select></label>
    </div>
    {design.hero === "slides" ? <div className="space-y-4">
      <p className="text-sm">画像は矢印で切り替えます。画像を追加するまではメイン画像を表示します。</p>
      {design.slides.map((slide, index) => <fieldset key={index} className="space-y-3 rounded-xl border border-[var(--mikke-line)] p-3"><legend>スライド {index + 1}</legend>
        <ImagePicker currentUrl={slide.url} onUploaded={url => onChange({ ...design, slides: design.slides.map((item, i) => i === index ? { ...item, url } : item) })} />
        <label className="grid gap-2">画像の説明（読み上げ用）<input className={control} value={slide.alt} onChange={event => onChange({ ...design, slides: design.slides.map((item, i) => i === index ? { ...item, alt: event.target.value } : item) })} /></label>
        <div className="flex gap-4"><button type="button" className={control} disabled={index === 0} onClick={() => { const slides = [...design.slides]; [slides[index - 1], slides[index]] = [slides[index], slides[index - 1]]; onChange({ ...design, slides }); }}>前へ</button><button type="button" className={control} onClick={() => onChange({ ...design, slides: design.slides.filter((_, i) => i !== index) })}>削除</button></div>
      </fieldset>)}
      <button type="button" className={control} onClick={() => onChange({ ...design, slides: [...design.slides, { url: "", alt: "" }] })}>＋ スライドを追加</button>
    </div> : null}
    <details><summary className="cursor-pointer py-3">ヒーローのプレビュー</summary><AcademyFrontHero design={design} title={title} message={message} imageUrl={imageUrl} /></details>
  </section>;
}
