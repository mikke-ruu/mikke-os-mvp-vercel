"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {listSalesPlanCatalog,type SalesPlanCatalogItem,type SalesPlanPublicationState} from "@/lib/academy2/sales-plan-catalog";
import {salesPlanChoices,salesPlanSamples} from "@/lib/academy2/sales-plan-presets";
import { type SalesPlanDraft } from "@/lib/academy2/sales-plan-drafts";
import { toAcademyContextHref } from "@/lib/academy/access-context";
import styles from "./sales-plan-catalog.module.css";

const money = (value: number | null | undefined): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function total(values: (number | null | undefined)[]): number | null {
  if (!values.length || !values.every(money)) return null;
  const sum = values.reduce<number>((sum, value) => sum + (value as number), 0);
  return Number.isSafeInteger(sum) ? sum : null;
}
const yen = (value: number | null) => value === null ? "未設定" : `¥${value.toLocaleString("ja-JP")}`;

/** Draft persistence is not a publication-state read contract. */
export function salesPlanDraftStatus(draft: SalesPlanDraft) {
  return draft.status === "draft"
    ? { status: "編集用下書き · 公開状態は未確認", filter: "draft" }
    : { status: "編集状態・公開状態は未確認", filter: "unknown" };
}

/** Read historical snapshots; never substitute legacy course.price or current course prices. */
export function salesPlanDraftSummary(draft: SalesPlanDraft): string {
  const ids = draft.course_snapshot.map(course => course.course_id);
  const unresolvedAllCourses = draft.configuration.kind === "全講座" && draft.hold_reasons.includes("all_courses_eligibility_source_pending");
  const references = ids.map(id => draft.reference_price_snapshot.find(row => row.course_id === id)?.amount);
  const reference = unresolvedAllCourses ? null : total(references);
  const price = draft.sale_price_snapshot;
  const staged = price.purchase_mode === "staged";
  const sale = staged ? total(ids.map(id => price.stage_prices[id])) : money(price.price) ? price.price : null;
  const label = draft.configuration.kind === "月額レッスン" ? "月額料金" : staged ? "講座ごとに料金・コース内合計" : "販売価格";
  const courses = unresolvedAllCourses ? "全講座の対象設定を確認中" : ids.length ? `${ids.length}講座` : "講座未設定";
  return `${courses} · ${label} ${yen(sale)} · 単品参考価格合計 ${yen(reference)}`;
}


export function salesPlanPublicationLabel(publication:SalesPlanPublicationState|undefined){
 if(!publication)return '公開状態は未確認';
 switch(publication.state){case 'published':return publication.has_unpublished_changes?'公開中・未反映の変更あり':'公開中';case 'not_published':return '未公開';case 'archived':return '受付終了・保管中';case 'unavailable':return '公開停止中';default:return '公開状態は未確認';}
}
function kindLabel(draft:SalesPlanDraft){return draft.configuration.kind==='コース'&&draft.configuration.after?.skill_certification?'認定講座':draft.configuration.kind;}
function salePrice(draft:SalesPlanDraft){const p=draft.sale_price_snapshot;return yen(p.purchase_mode==='staged'?total(draft.course_snapshot.map(c=>p.stage_prices[c.course_id])):money(p.price)?p.price:null)+(draft.configuration.kind==='月額レッスン'?' / 月':'');}
export function SalesPlanNewChoices({headquartersId}:{headquartersId:string}){return <div className={styles['choice-grid']}>{salesPlanChoices.map(choice=><Link className={styles.choice} key={choice.id} href={toAcademyContextHref('/academy/offerings/new?preset='+choice.id,headquartersId,'manage')}><div className={styles['choice-icon']}>{choice.icon}</div><strong>{choice.kind}</strong><p>{choice.description}</p></Link>)}</div>;}
export function SalesPlanSamples({headquartersId}:{headquartersId:string}){return <main className={styles.wrap}><Link className={styles.back} href={toAcademyContextHref('/academy/offerings',headquartersId,'manage')}>← 販売プラン一覧へ</Link><div className={styles.titlebar}><div className={styles.en}>SALES PLAN SAMPLES</div><div className={styles.jp}>販売プランの見本</div></div><div className={styles.headbox}><p>見本の名前と価格を新しい販売プランに入れて編集できます。講座はご自身の講座から選んでください。</p></div><div className={styles.list} style={{marginTop:20}}>{salesPlanSamples.map(sample=>{const choice=salesPlanChoices.find(c=>c.id===sample.id)!;return <Link className={styles.course} key={sample.id} href={toAcademyContextHref('/academy/offerings/new?preset='+sample.id+'&sample='+sample.id,headquartersId,'manage')}><div className={styles.thumb}>{choice.icon}</div><div><h3>{sample.title}</h3><div className={styles['course-meta']}><b>見本・{choice.kind}</b><span>{sample.summary}</span><span>例：{yen(sample.price)}{sample.id==='monthly'?' / 月':''}</span></div></div><span className={styles.arrow}>›</span></Link>;})}</div><p className={styles.publicationNote}>見本を選んでも公開・認定・ライセンス付与は行いません。保存する前に、講座・価格・各設定を確認してください。</p></main>;}
export function SalesPlanDraftCatalog({ headquartersId }: { headquartersId: string }) {
 const [drafts,setDrafts]=useState<SalesPlanCatalogItem[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0),[query,setQuery]=useState(''),[sort,setSort]=useState('updated');const modal=useRef<HTMLDialogElement>(null);
 useEffect(()=>{let live=true;setLoading(true);setError(null);setDrafts([]);listSalesPlanCatalog(headquartersId).then(rows=>{if(live)setDrafts(rows);}).catch(cause=>{if(live)setError(cause instanceof Error?cause.message:'販売プランを読み込めませんでした。');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[headquartersId,retry]);
 const rows=drafts.filter(d=>d.configuration.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a,b)=>sort==='name'?a.configuration.title.localeCompare(b.configuration.title,'ja'):b.updated_at.localeCompare(a.updated_at));
 return <main className={styles.wrap}><section><div className={styles.titlebar}><div className={styles.en}>SALES PLANS</div><div className={styles.jp}>販売プラン</div></div><div className={styles.headbox}><p>作った講座を組み合わせて、価格・支払い・受講方法など「どう売るか」を設定します。</p><button className={styles.create} type="button" onClick={()=>modal.current?.showModal()}>＋ 販売プランをつくる</button></div></section>
 <div className={styles.flow}><b>講座</b><span>教える内容</span><span>→</span><b>販売プラン</b><span>組み合わせ・価格・売り方</span><span>→</span><b>開催</b><span>日時・担当者・定員</span></div>
 <div className={styles.tools}><input className={styles.search} placeholder="販売プラン名で検索" aria-label="販売プラン名で検索" value={query} onChange={e=>setQuery(e.target.value)}/><select className={styles.filter} aria-label="並び替え" value={sort} onChange={e=>setSort(e.target.value)}><option value="updated">更新が新しい順</option><option value="name">名前順</option></select></div>
 {loading?<p role="status">販売プランを読み込み中…</p>:error?<div role="alert"><p>{error}</p><button type="button" className={styles.filter} onClick={()=>setRetry(n=>n+1)}>再読み込み</button></div>:<section className={styles.list} aria-label="販売プラン一覧">{rows.map(draft=>{const kind=kindLabel(draft),choice=salesPlanChoices.find(c=>c.kind===kind);return <Link className={styles.course} key={draft.id} href={toAcademyContextHref('/academy/offerings/'+draft.id,headquartersId,'manage')} title={salesPlanDraftSummary(draft)}><div className={styles.thumb}>{choice?.icon??'プラン'}</div><div><h3>{draft.configuration.title||'名称未設定'}</h3><div className={styles['course-meta']}><b>{kind}</b><span>{draft.course_snapshot.map(c=>c.title).join(' → ')||'講座未設定'}</span>{draft.configuration.after?.commercial_license&&<span>ライセンスあり</span>}{draft.configuration.kit?.enabled&&<span>キットあり</span>}<span>{salePrice(draft)}</span><span>{salesPlanPublicationLabel(draft.publication)}</span></div><span className={styles.reference}>{salesPlanDraftSummary(draft).split(' · ').at(-1)}</span></div><span className={styles.arrow}>›</span></Link>;})}{!rows.length&&<p>{drafts.length?'条件に合う販売プランがありません。':'販売プランはまだありません。'}</p>}</section>}
 <div className={styles['empty-tip']}><div><strong>販売タイプによって、必要な設定だけを表示します。</strong><p>認定講座にはライセンスやキット、月額レッスンには継続決済など、その販売方法に必要な項目だけを設定します。</p></div><Link className={styles['text-link']} href={toAcademyContextHref('/academy/offerings/new?view=samples',headquartersId,'manage')}>販売プランの見本を見る →</Link></div>
 <dialog ref={modal} className={styles.modal} aria-label="販売プランの種類を選ぶ"><div className={styles['modal-head']}><strong>CHOOSE A SALES PLAN</strong><small>どんな売り方をしますか？</small></div><div className={styles['modal-body']}><SalesPlanNewChoices headquartersId={headquartersId}/><button className={styles.close} type="button" onClick={()=>modal.current?.close()}>閉じる</button></div></dialog>
 </main>;
}
