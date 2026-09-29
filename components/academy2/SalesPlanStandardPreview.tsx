"use client";

import { useEffect, useState, type ReactNode } from 'react';
import {MonthlyPolicySummary} from './MonthlyPolicySummary';
import {LocalMonthlyReviewEntry} from './LocalMonthlyReviewEntry';
import { SalesPlanPageContent } from './SalesPlanPageEditor';
import { getSalesPage, saveSalesPage, type SalesPageDraft } from '@/lib/academy2/sales-pages';
import type { Academy2Course } from '@/lib/academy2/courses';
import type { SalesPlanDraft } from '@/lib/academy2/sales-plan-drafts';
import { SalesPlanPublicationPanel } from './SalesPlanPublicationPanel';
import styles from './sales-page-workspace.module.css';
import { standardSalesPageBlocks } from '@/lib/academy2/standard-sales-page';
import { SalesPlanApplicationPreview } from './SalesPlanApplicationPreview';
import { listAcademy2Events, type Academy2EventSummary } from '@/lib/academy2/operations';

/** Reuse the existing public course renderer. This does not publish or accept applications. */
export function SalesPlanStandardPreview({ draft, courses, onBack, onMode, children }: {
  draft: SalesPlanDraft; courses: Academy2Course[]; onBack: () => void; onMode?: (mode: 'builder'|'template') => void; children?: ReactNode;
}) {
  const [page, setPage] = useState<SalesPageDraft | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [formPreview, setFormPreview] = useState(false);
  const [events, setEvents] = useState<Academy2EventSummary[] | null>(null);
  const [eventsError, setEventsError] = useState('');
  useEffect(() => {
    let live = true; setEvents(null); setEventsError('');
    if (draft.configuration.study_style === 'materials_only') { setEvents([]); return; }
    listAcademy2Events(draft.headquarters_id).then(rows => { if (live) setEvents(rows.filter(row => row.sales_plan_id === draft.id)); })
      .catch(cause => { if (live) setEventsError(cause instanceof Error ? cause.message : '開催を読み込めませんでした。'); });
    return () => { live = false; };
  }, [draft.headquarters_id, draft.id, draft.configuration.study_style, retry]);
  useEffect(() => {
    let live = true; setPage(null); setError('');
    getSalesPage(draft.headquarters_id, draft.id).then(row => { if (live) setPage(row.revision === 0 ? {...row,blocks:standardSalesPageBlocks(draft,courses)} : row); })
      .catch(cause => { if (live) setError(cause instanceof Error ? cause.message : '販売ページを読み込めませんでした。'); });
    return () => { live = false; };
  }, [draft.headquarters_id, draft.id, draft.revision, retry]);
  const configuration = draft.configuration;
  const price = draft.sale_price_snapshot;
  const ids = configuration.course_ids.length ? configuration.course_ids : draft.course_snapshot.map(course => course.course_id);
  const orderedCourses = ids.map(id => draft.course_snapshot.find(course => course.course_id === id)).filter((course): course is SalesPlanDraft["course_snapshot"][number] => !!course);
  const amounts = ids.map(id => price.stage_prices[id]);
  const amount = price.purchase_mode === 'staged'
    ? amounts.length && amounts.every(value => typeof value === 'number') ? amounts.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null
    : price.price;
  if (error) return <div role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>再読み込み</button></div>;
  if (!page) return <p role="status">販売ページを読み込み中…</p>;
  const save = async () => { if (saving) return; setSaving(true); setSaveError(''); try { setPage(await saveSalesPage(draft.headquarters_id,draft.id,page.revision,draft.revision,page.blocks)); } catch (cause) { setSaveError(cause instanceof Error?cause.message:'保存できませんでした。もう一度お試しください。'); } finally { setSaving(false); } };
  const priceLabel = amount === null ? '未設定' : `¥${amount.toLocaleString('ja-JP')}`;
  return <section className={styles.workspace}>
    <button type="button" className={styles.back} onClick={onBack}>← 販売プラン「{configuration.title}」へ</button>
    <div className={styles.headrow}><header className={styles.title}><h1>販売ページ</h1><p>販売プランからページを作成します。このまま使うことも、見せ方を変更することもできます。</p></header><div className={styles.actions}><button type="button" className={styles.button} aria-pressed={mobile} onClick={()=>setMobile(value=>!value)}>{mobile?'PCで確認':'スマホで確認'}</button><button type="button" className={`${styles.button} ${styles.save}`} disabled={saving} onClick={()=>void save()}>{saving?'保存中…':'保存'}</button></div></div>
    <nav className={styles.tabs} aria-label="販売ページの作成方法"><button type="button" aria-current="page">標準ページ</button><button type="button" onClick={()=>onMode?.('template')}>テンプレート</button><button type="button" onClick={()=>onMode?.('builder')}>ビルダー</button></nav>
    {saveError && <p role="alert">{saveError}</p>}
    {page.needs_rebase && <p role="status" className={styles.help}>販売プランが更新されています。内容を確認して保存してください。</p>}
    <div className={styles.two}><div className={styles.previewShell}><div className={styles.browser}><div className={styles.browserbar}><span className={styles.dot}/><span className={styles.dot}/><span className={styles.dot}/><span>販売ページのプレビュー</span></div><div className={styles.public} data-mobile={mobile}>
      <header className={styles.pubTop}>{configuration.title}</header>
      <SalesPlanPageContent blocks={page.blocks} courses={courses.filter(course => ids.includes(course.id))}/>
      <section className={styles.section}><h2>{configuration.kind==='月額レッスン'?'月額料金':price.purchase_mode==='staged'?'講座ごとの料金':'料金'}</h2><div className={styles.price}>{priceLabel}</div>{price.purchase_mode==='staged'&&orderedCourses.map(course=><p key={course.course_id}>{course.title}：{price.stage_prices[course.course_id]==null?'未設定':`¥${price.stage_prices[course.course_id]!.toLocaleString('ja-JP')}`}</p>)}{configuration.terms?.body&&<details><summary>申込規約</summary><p style={{whiteSpace:'pre-wrap'}}>{configuration.terms.body}</p></details>}</section>
      {configuration.kind==='月額レッスン'&&<section className={styles.section}><MonthlyPolicySummary monthly={configuration.monthly} showIssues/></section>}
      {configuration.study_style !== 'materials_only' && <section className={styles.section}><h2>開催日程</h2>{eventsError ? <div role="alert"><p>{eventsError}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>再読み込み</button></div> : events === null ? <p role="status">開催を読み込み中…</p> : events.length === 0 ? <p>開催を作成すると、募集する日時や日程相談の案内を表示できます。</p> : events.map(event=><article key={event.id}><h3>{event.title}</h3><p>{event.schedule_mode==='arranged_after_application'?'申込後に日程を相談':event.starts_at?new Date(event.starts_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}):'日時未設定'} ／ {event.format==='online'?'オンライン':'対面'}</p><p>{event.capacity===null?'定員の制限なし':`定員 ${event.capacity}名`}</p></article>)}</section>}
      <section id="apply" className={styles.section}><h2>お申込み</h2><p>公開後の販売ページで開催を選び、申込フォームへ進めます。</p><button type="button" className={`${styles.button} ${styles.save}`} onClick={()=>setFormPreview(true)}>申込フォームを確認する</button></section>
    </div></div></div><aside><section className={styles.summary}><h2>標準ページ</h2><p className={styles.help}>販売プランの設定から作成するページです。ビルダーを使わずに募集できます。</p><dl><div><dt>販売プラン</dt><dd>{configuration.title}</dd></div><div><dt>講座</dt><dd>{ids.length}講座</dd></div><div><dt>料金</dt><dd>{priceLabel}</dd></div><div><dt>保存</dt><dd>{page.revision===0?'未保存':page.needs_rebase?'更新を確認':'保存済み'}</dd></div></dl></section><section className={styles.summary}><h2>ページの作り方</h2><div className={styles.mode}><strong>このまま使う</strong><p>標準ページを保存して募集の設定へ進みます。</p><button type="button" disabled={saving} onClick={()=>void save()}>このページを使う</button></div><div className={styles.mode}><strong>ビルダーでカスタム</strong><p>文章・画像・配置を編集できます。</p><button type="button" onClick={()=>onMode?.('builder')}>ビルダーを開く</button></div><div className={styles.mode}><strong>テンプレートから作る</strong><p>具体例を自分の内容に変更して使います。</p><button type="button" onClick={()=>onMode?.('template')}>テンプレートを見る</button></div></section></aside></div>
    {children}<SalesPlanPublicationPanel draft={draft} page={page}/><LocalMonthlyReviewEntry draft={draft}/>
    {formPreview && <SalesPlanApplicationPreview configuration={configuration} fields={configuration.application_form?.fields??[]} onClose={()=>setFormPreview(false)}/>}
  </section>;
}
