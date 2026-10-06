"use client";
import { useState } from "react";
import type { AcademyFrontDesign } from "@/lib/academy/front-design";
import { frontMaxWidth } from "@/lib/academy/front-design";

export function AcademyFrontHero({ design, title, message, imageUrl, canApply = true }: { design: AcademyFrontDesign; title: string; message: string; imageUrl: string; canApply?: boolean }) {
  const [selected, setSelected] = useState(0);
  if (design.hero === "hidden") return null;
  const slides = design.slides.filter(slide => slide.url);
  const index = Math.min(selected, Math.max(0, slides.length - 1));
  const active = design.hero === "slides" && slides.length ? slides[index] : { url: imageUrl, alt: "" };
  return <section style={{ maxWidth: frontMaxWidth(design) }} className={`mx-auto grid min-w-0 items-center gap-8 px-5 py-12 md:py-20 ${design.hero === "split" ? "md:grid-cols-2" : ""}`} aria-label="ホームページのメイン紹介">
    <div className={design.hero === "split" ? "" : "order-2"}>
      <h1 className="text-2xl font-bold leading-relaxed tracking-wide md:text-4xl">{title}</h1>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 md:text-[15px]">{message}</p>
      <div className="mt-6 flex flex-wrap items-center gap-4">{canApply ? <><a href="#services" className="rounded-full bg-[var(--mikke-accent)] px-6 py-3 text-sm font-bold text-white">講座に申し込む</a><a href="#courses" className="text-sm font-bold text-[var(--mikke-accent-strong)]">講座一覧を見る →</a></> : <a href="#courses" className="rounded-full bg-[var(--mikke-accent)] px-6 py-3 text-sm font-bold text-white">講座一覧を見る</a>}</div>
    </div>
    <div className="min-w-0">
      {active.url ? <img src={active.url} alt={active.alt} className={`w-full rounded-3xl object-cover ${design.hero === "split" ? "aspect-[4/3]" : "aspect-[16/9]"}`} /> : <div className="aspect-[4/3] rounded-3xl bg-[var(--mikke-surface-soft)]" />}
      {design.hero === "slides" && slides.length > 1 ? <div className="mt-3 flex items-center justify-center gap-4"><button type="button" className="min-h-11 px-4" aria-label="前のスライド" onClick={() => setSelected((index + slides.length - 1) % slides.length)}>←</button><span aria-live="polite">{index + 1} / {slides.length}</span><button type="button" className="min-h-11 px-4" aria-label="次のスライド" onClick={() => setSelected((index + 1) % slides.length)}>→</button></div> : null}
    </div>
  </section>;
}
