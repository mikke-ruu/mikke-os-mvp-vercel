"use client";
import { useEffect, useState } from "react";
import { resolveSelectedMediaCards, type MediaCardSelection, type MediaDestination, type SelectedMediaCard } from "@/lib/media-app/selected-cards";
const names = { story: "STORY", page: "Page", academy: "Academy" };
export function MediaConnectionPreview() {
  const [kind, setKind] = useState<MediaDestination["kind"]>("page");
  const [published, setPublished] = useState(true);
  const [cycle, setCycle] = useState(1);
  const [selection, setSelection] = useState<MediaCardSelection | null>(null);
  const [result, setResult] = useState<{key: string; cards: SelectedMediaCard[]} | null>(null);
  const key = JSON.stringify({kind,published,cycle,selection});
  useEffect(() => {
    const controller = new AbortController();
    void resolveSelectedMediaCards({kind,key:"preview-only"}, selection ? [selection] : [], async () => ({
      destinationKind:kind,destinationKey:"preview-only",mediaSlug:"sample-cake-shop",articleSlug:"baking-note",locale:"ja",revision:"a".repeat(64),publication:`cycle-${cycle}`,
      active:true,sourcePublished:published,destinationPublished:true,access:"free",title:"お店で大切にしているケーキ作り",excerpt:"材料の選び方と、毎日の仕込みで大切にしていることを紹介します。（動作確認用の架空記事）",publishedAt:"2026-09-09T00:00:00Z"
    }), {signal:controller.signal}).then(cards => {if(!controller.signal.aborted) setResult({key,cards});});
    return () => controller.abort();
  },[key,kind,published,cycle,selection]);
  const cards = result?.key === key ? result.cards : [];
  const button = "rounded-xl border border-[var(--mikke-line)] px-4 py-3 text-sm font-bold disabled:opacity-40";
  return <div className="mx-auto max-w-4xl">
    <h1 className="text-3xl font-bold">記事を他のアプリに載せる</h1>
    <p className="mt-3 text-sm leading-7 text-[var(--mikke-muted)]">連携の動作確認用です。架空のお店と無料記事を使っています。実際のSTORY・Page・Academyには掲載されません。</p>
    <div className="mt-7 flex flex-wrap gap-2" aria-label="掲載先の見本">{(Object.keys(names) as MediaDestination["kind"][]).map(item => <button key={item} type="button" aria-pressed={kind===item} className={button} onClick={()=>{setKind(item);setSelection(null);}}>{names[item]}</button>)}</div>
    <section className="mt-7 rounded-2xl border border-[var(--mikke-line)] p-5 sm:p-7">
      <h2 className="font-bold">1. 載せたい記事を選ぶ</h2><p className="mt-4 font-semibold">お店で大切にしているケーキ作り</p><p className="mt-2 text-sm">記事の状態：{published?"公開中の見本":"非公開の見本"}</p>
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" className={button} disabled={!published} onClick={()=>setSelection({destination:{kind,key:"preview-only"},mediaSlug:"sample-cake-shop",articleSlug:"baking-note",locale:"ja",approvedRevision:"a".repeat(64),approvedPublication:`cycle-${cycle}`})}>{names[kind]}に載せる記事として選ぶ</button><button type="button" className={button} disabled={!selection} onClick={()=>setSelection(null)}>掲載を解除</button></div>
    </section>
    <section className="mt-6 border-y border-[var(--mikke-line)] py-7" aria-live="polite"><h2 className="font-bold">2. {names[kind]}での表示見本</h2><p className="mt-2 text-sm text-[var(--mikke-muted)]">{kind==="page"?"ケーキ屋さんの公式Page":kind==="story"?"書き手のSTORYプロフィール":"教室のAcademyページ"}に置く記事欄です。</p>
      {cards.length?cards.map(card=><article key={card.canonicalUrl} className="mt-5 rounded-2xl border border-[var(--mikke-line)] p-6"><p className="text-xs text-[var(--mikke-muted)]">MEDIA · 無料記事</p><h3 className="mt-3 text-xl font-bold">{card.title}</h3><p className="mt-3 text-sm leading-7">{card.excerpt}</p><p className="mt-4 text-sm font-bold text-[var(--mikke-primary)]">記事を読む（見本のため移動しません）</p></article>):<p className="mt-5 py-5 text-sm text-[var(--mikke-muted)]">表示する記事はありません。選択していない記事や非公開の記事は載りません。</p>}
    </section>
    <section className="py-7"><h2 className="font-bold">公開をキャンセルしたときの動きも確認できます</h2><p className="mt-2 text-sm leading-7 text-[var(--mikke-muted)]">非公開にすると記事欄から消えます。再公開しても自動では戻りません。もう一度記事を選ぶと表示されます。</p><button type="button" className={`${button} mt-4`} onClick={()=>{if(published)setPublished(false);else {setCycle(value=>value+1);setPublished(true);}}}>{published?"見本記事を非公開にする":"見本記事を再公開する"}</button></section>
  </div>;
}
