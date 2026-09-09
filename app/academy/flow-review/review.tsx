"use client";
import {useReducer,useState} from "react";
import Link from "next/link";
import {initial,reduce,WEEK} from "./model";
const date=(n:number)=>new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",dateStyle:"long",timeStyle:"short"}).format(n);
const box="rounded-lg border border-[var(--mikke-line)] bg-white p-4 sm:p-5";
const button="min-h-11 rounded-lg border border-[var(--mikke-line)] px-4 py-2 text-sm disabled:opacity-40";
export function FlowReview({ initialTab = "publish", returnHref }: { initialTab?: "publish" | "community"; returnHref?: string | null }){
  const [s,send]=useReducer(reduce,initial);
  const [tab,setTab]=useState<"publish"|"community">(initialTab);
  const end=(s.first??s.now)+WEEK;
  return <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 text-[var(--mikke-text)]">
    <p className="rounded-lg border border-[#ffd370] px-4 py-3 text-sm leading-6">開発専用の操作見本です。金額・人物・日時は架空。保存・契約・公開・決済・招待送信は一切行いません。再読み込みで元に戻ります。</p>
    <header><Link className="inline-flex min-h-11 items-center text-sm text-[var(--mikke-primary)]" href={returnHref || "/academy/h/00000000-0000-4000-8000-000000000001/manage?preview=walkthrough"}>{returnHref ? "← 元のページへ戻る" : "← 本部ホームの確認版へ"}</Link><h1 className="mt-3 text-2xl font-bold">公開と先生の招待を試す</h1><p className="mt-2 text-sm">準備が整ったら、何を確認して次へ進むかを体験できます。</p></header>
    <nav aria-label="確認する流れ" className="flex flex-wrap gap-2">{([['publish','講座の初公開'],['community','先生をCommunityへ招待']] as const).map(([value,label])=><button className={button} aria-pressed={tab===value} key={value} onClick={()=>{setTab(value);}}>{label}</button>)}</nav>
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#ffd370] p-3"><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={s.owner} onChange={e=>send({type:"owner",value:e.target.checked})}/>責任者として操作（OFFで権限不足を確認）</label><button className={button} onClick={()=>send({type:"reset"})}>最初から試す</button></section>
    {s.message?<p role="status" className={`${box} border-l-4 border-l-[var(--mikke-primary)] text-sm leading-7`}>{s.message}</p>:null}
    {tab==='publish'?<>
      <section className={`${box} border-t-4 border-t-[#8bc7ad]`}><p className="text-sm">教室の利用状態</p><h2 className="mt-2 text-xl font-bold">{s.cancelled?"有料移行の取消受付済み":s.paid?"有料利用中（見本）":s.first===null?"準備中 — 無料期間はまだ始まっていません":s.now>=end?"無料終了・支払い未確定（見本）":"7日間無料体験中"}</h2><p className="mt-2 text-sm">講座：{s.published?'公開中':'下書き'} ／ 確認用の現在日時：{date(s.now)}</p>{s.first!==null?<p className="mt-2 text-sm">初公開：{date(s.first)}<br/>無料終了：{date(end)}（日本時間）</p>:null}</section>
      <section className={box}><h2 className="text-lg font-bold">1. 公開前に確認する</h2><p className="mt-2">サンプル講座「はじめての手づくり教室」</p><dl className="mt-4 space-y-2 text-sm"><div><dt>初回月額（架空の表示例・実料金ではありません）</dt><dd className="text-xl font-bold">3,300円（税込）</dd></div><div><dt>この見本で今公開した場合の無料終了</dt><dd>{date(end)}（日本時間）</dd></div></dl><p className="mt-3 text-sm leading-7">初回料金は公開時に確定。人数の変化は次回更新から反映する想定です。下書きへ戻しても契約は終了しません。無料終了日時までの有料移行取消は、初回請求を止めます。</p><label className="mt-3 flex items-start gap-2 text-sm leading-7"><input className="mt-2" type="checkbox" checked={s.agreed} onChange={e=>send({type:"agree",value:e.target.checked})}/>見本の料金・開始日時・取消方法を確認しました（実際の契約への同意ではありません）</label><div className="mt-4 flex flex-wrap gap-2"><button className={`${button} border-transparent bg-[var(--mikke-accent)] font-bold text-white`} onClick={()=>send({type:"publish"})}>{s.first===null?'初公開を試す':'再公開を試す'}</button><button className={button} onClick={()=>send({type:"fail"})}>公開失敗を再現</button></div></section>
      <section className={box}><h2 className="text-lg font-bold">2. 公開後の状態を確かめる</h2><div className="mt-4 flex flex-wrap gap-2"><button className={button} onClick={()=>send({type:"draft"})}>下書きに戻す</button><button className={button} onClick={()=>send({type:"deadline"})}>無料終了日時まで進める</button><button className={button} onClick={()=>send({type:"cancel"})}>有料移行を取り消す</button><button className={button} onClick={()=>send({type:"pay"})}>支払い成功を再現</button></div><p className="mt-3 text-xs leading-6">この見本は逐次操作です。同時刻の取消と請求の競合・決済同期・料金算定は未接続で、実環境での検証は別途必要です。</p></section>
    </>:<>
      <section className={box}><h2 className="text-lg font-bold">1. 招待する先生と参加範囲を確認</h2><p className="mt-3 text-sm leading-7">接続先：サンプル教室Community<br/>先生：サンプル先生（架空）<br/>参加できるRoom：先生同士の相談室／講師向けのお知らせ</p><p className="mt-3 text-sm leading-7">本部とCommunity両方の責任者だけが招待する想定です。承諾までは参加できません。本部の管理権限は付与せず、既存のCommunity契約も変更しません。</p><button className={`${button} mt-4 bg-[var(--mikke-accent)] text-white`} onClick={()=>send({type:"invite"})}>この内容で招待を試す（送信なし）</button></section>
      <section className={`${box} border-t-4 border-t-[#8bc7ad]`}><h2 className="text-lg font-bold">2. 招待された先生の画面</h2><p className="mt-3">状態：{{none:'未招待',pending:'承諾待ち',accepted:'参加済み',cancelled:'招待取消済み'}[s.invitation]}</p>{s.rooms.length?<p className="mt-2 text-sm">招待時に案内した範囲：{s.rooms.join('／')}</p>:null}<div className="mt-4 flex flex-wrap gap-2"><button className={button} onClick={()=>send({type:"accept"})}>先生本人の承諾を再現</button><button className={button} onClick={()=>send({type:"revoke"})}>運営側の招待取消を再現</button></div><p className="mt-3 text-xs leading-6">招待画面の独立した見本です。無料体験中に招待を許可する条件、失効・辞退・定員検査・本人認証はまだ接続していません。</p></section>
    </>}
  </main>;
}
