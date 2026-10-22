"use client";

import { AcademyManagementActions } from './AcademyManagementActions';
import { BookOpen } from "lucide-react";
import {listAcademy2Events} from "@/lib/academy2/operations";
import { useEffect, useState } from "react";
import Link from "next/link";
import {listSalesPlanCatalog,type SalesPlanCatalogItem,type SalesPlanPublicationState} from "@/lib/academy2/sales-plan-catalog";
import {salesPlanChoices,salesPlanSamples,isAcademy2OpenSalesPlanId} from "@/lib/academy2/sales-plan-presets";
import { type SalesPlanDraft } from "@/lib/academy2/sales-plan-drafts";
import { toAcademyContextHref } from "@/lib/academy/access-context";
import {listAcademy2Courses,type Academy2Course} from "@/lib/academy2/courses";
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
  const label = draft.configuration.kind === "月額レッスン" ? "月額料金" : staged ? "講座ごとの支払い・販売価格の合計" : "販売価格";
  const courses = unresolvedAllCourses ? "全講座の対象設定を確認中" : ids.length ? `${ids.length}講座` : "講座未設定";
  return `${courses} · ${label} ${yen(sale)} · 単品参考価格合計 ${yen(reference)}`;
}


export function salesPlanPublicationLabel(publication:SalesPlanPublicationState|undefined){
 if(!publication)return '公開状態は未確認';
 switch(publication.state){case 'published':return publication.has_unpublished_changes?'公開中・未反映の変更あり':'公開中';case 'not_published':return '下書き';case 'archived':return '非公開';case 'unavailable':return '公開状態の確認が必要';default:return '公開状態は未確認';}
}
function kindLabel(draft:SalesPlanDraft){return draft.configuration.kind==='コース'&&draft.configuration.after?.skill_certification?'認定講座':draft.configuration.kind;}
function salePrice(draft:SalesPlanDraft){const p=draft.sale_price_snapshot;return yen(p.purchase_mode==='staged'?total(draft.course_snapshot.map(c=>p.stage_prices[c.course_id])):money(p.price)?p.price:null)+(draft.configuration.kind==='月額レッスン'?' / 月':'');}
export function SalesPlanNewChoices({headquartersId}:{headquartersId:string}){return <div className={styles['choice-grid']}>{salesPlanChoices.filter(choice=>isAcademy2OpenSalesPlanId(choice.id)).map(choice=><Link className={styles.choice} key={choice.id} href={toAcademyContextHref('/academy/offerings/new?preset='+choice.id,headquartersId,'manage')}><div className={styles['choice-icon']}>{choice.icon}</div><strong>{choice.kind}</strong><p>{choice.description}</p></Link>)}</div>;}
export function SalesPlanSamples({headquartersId}:{headquartersId:string}){return <main className={styles.wrap}><Link className={styles.back} href={toAcademyContextHref('/academy/offerings',headquartersId,'manage')}>← 販売プラン一覧へ</Link><div className={styles.titlebar}><div className={styles.en}>SALES PLAN SAMPLES</div><div className={styles.jp}>販売プランの見本</div></div><div className={styles.headbox}><p>見本をもとに、名前や価格を変更して販売プランをつくれます。講座はご自身の講座から選びます。</p></div><div className={`${styles.list} ${styles.samples}`} style={{marginTop:20}}>{salesPlanSamples.filter(sample=>isAcademy2OpenSalesPlanId(sample.id)).map(sample=>{const choice=salesPlanChoices.find(c=>c.id===sample.id)!;return <Link className={styles.course} key={sample.id} href={toAcademyContextHref('/academy/offerings/new?preset='+sample.id+'&sample='+sample.id,headquartersId,'manage')}><div className={styles.thumb}>{choice.icon}</div><div><h3>{sample.title}</h3><div className={styles['course-meta']}><b>{choice.kind}の見本</b><span>{sample.summary}</span><span>例：{yen(sample.price)}{sample.id==='monthly'?' / 月':''}</span></div></div><span className={styles.arrow}>›</span></Link>;})}</div><p className={styles.publicationNote}>見本を選んでも自動で公開されません。内容を確認してから保存してください。</p></main>;}
export function SalesPlanDraftCatalog({ headquartersId }: { headquartersId: string }) {
 const [showArchived,setShowArchived]=useState(false);
 const [drafts,setDrafts]=useState<SalesPlanCatalogItem[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0),[query,setQuery]=useState(''),[sort,setSort]=useState('updated');
 useEffect(()=>{let live=true;setLoading(true);setError(null);setDrafts([]);listSalesPlanCatalog(headquartersId).then(rows=>{if(live)setDrafts(rows);}).catch(cause=>{if(live)setError(cause instanceof Error?cause.message:'販売プランを読み込めませんでした。');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[headquartersId,retry]);
 const [eventCounts,setEventCounts]=useState<Record<string,number>|null>(null);
 useEffect(()=>{let live=true;setEventCounts(null);listAcademy2Events(headquartersId).then(events=>{if(live){const counts:Record<string,number>={};for(const e of events)if(e.sales_plan_id)counts[e.sales_plan_id]=(counts[e.sales_plan_id]??0)+1;setEventCounts(counts);}}).catch(()=>{});return()=>{live=false;};},[headquartersId,retry]);
 const [courseImages,setCourseImages]=useState<Record<string,string>>({});
 useEffect(()=>{let live=true;setCourseImages({});listAcademy2Courses(headquartersId).then((courses:Academy2Course[])=>{if(live)setCourseImages(Object.fromEntries(courses.filter(course=>course.main_image_url).map(course=>[course.id,course.main_image_url!])));}).catch(()=>{/* Decorative thumbnails must not hide readable sales plans. */});return()=>{live=false;};},[headquartersId,retry]);
 const rows=drafts.filter(d=>d.configuration.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a,b)=>sort==='name'?a.configuration.title.localeCompare(b.configuration.title,'ja'):b.updated_at.localeCompare(a.updated_at));
 return <main className={`${styles.wrap} ${styles.catalog}`}><section><div className={styles.titlebar}><div className={styles.en}>SALES PLANS</div><div className={styles.jp}>販売プラン</div></div><div className={styles.headbox}><p>講座を選んで、価格・支払い方法・受講方法など「どう売るか」を設定します。</p><Link className={styles.create} href={toAcademyContextHref('/academy/create?entry=existing&tab=plan',headquartersId,'manage')}>＋ 販売プランをつくる</Link></div></section>

 <div className={styles.tools}><input className={styles.search} placeholder="販売プラン名で検索" aria-label="販売プラン名で検索" value={query} onChange={e=>setQuery(e.target.value)}/><select className={styles.filter} aria-label="並び替え" value={sort} onChange={e=>setSort(e.target.value)}><option value="updated">更新が新しい順</option><option value="name">名前順</option></select></div>
 <label><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> アーカイブ済みを表示</label>
 {loading?<p role="status">販売プランを読み込み中…</p>:error?<div role="alert"><p>{error}</p><button type="button" className={styles.filter} onClick={()=>setRetry(n=>n+1)}>再読み込み</button></div>:<section className={styles.list} aria-label="販売プラン一覧">{rows.map(draft=>{const kind=kindLabel(draft),image=draft.configuration.course_ids.map(id=>courseImages[id]).find(Boolean);return <AcademyManagementActions compact hideState key={draft.id} headquartersId={headquartersId} kind="plan" id={draft.id} title={draft.configuration.title||'名称未設定'} showArchived={showArchived} onChanged={()=>setRetry(n=>n+1)}><Link className={styles.course} href={toAcademyContextHref('/academy/offerings/'+draft.id,headquartersId,'manage')} title={salesPlanDraftSummary(draft)}><div className={styles.thumb}><BookOpen className={styles.thumbFallback} size={26} aria-hidden="true"/>{image&&<img src={image} alt="" onError={event=>{event.currentTarget.style.display='none';}}/>}</div><div><h3>{draft.configuration.title||'名称未設定'}</h3><div className={styles['course-meta']}><span>{kind==='コース'?'コース':kind}{draft.course_snapshot.length>1?'・'+draft.course_snapshot.length+'講座':''}</span><span>{salePrice(draft)}</span><span>{salesPlanPublicationLabel(draft.publication)}</span><span>開催 {eventCounts===null?'未確認':(eventCounts[draft.id]??0)+'件'}</span></div></div></Link></AcademyManagementActions>;})}{!rows.length&&<p>{drafts.length?'条件に合う販売プランがありません。':'販売プランはまだありません。'}</p>}</section>}
 <div className={styles['empty-tip']}><div><strong>販売プランの種類</strong><p>単品講座・コース・ワークショップから選べます。</p></div><Link className={styles['text-link']} href={toAcademyContextHref('/academy/offerings/new?view=samples',headquartersId,'manage')}>販売プランの見本を見る →</Link></div>
 </main>;
}
