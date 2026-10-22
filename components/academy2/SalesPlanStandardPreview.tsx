"use client";

import { useEffect, useState, type ReactNode } from 'react';
import {LocalMonthlyReviewEntry} from './LocalMonthlyReviewEntry';
import { SalesPlanPageContent } from './SalesPlanPageEditor';
import { getSalesPage, saveSalesPage, type SalesPageDraft } from '@/lib/academy2/sales-pages';
import type { Academy2Course } from '@/lib/academy2/courses';
import type { SalesPlanDraft } from '@/lib/academy2/sales-plan-drafts';
import { SalesPlanPublicationPanel } from './SalesPlanPublicationPanel';
import styles from './sales-page-workspace.module.css';
import { standardSalesPageBlocks,isStandardSalesPageV2,isStandardSalesPageV5 } from '@/lib/academy2/standard-sales-page';
import v5Styles from './standard-sales-page-v5.module.css';
import { SalesPlanApplicationPreview } from './SalesPlanApplicationPreview';
import { listAcademy2Events, type Academy2EventSummary } from '@/lib/academy2/operations';
import { readSalesPageDisplay } from '@/lib/academy2/sales-page-display';
import { SalesPageBottom } from './SalesPageBottom';
import presentationStyles from './sales-page-presentation.module.css';
import { salesPageHasVisibleTitle } from './SalesPagePresentation';

/** Reuse the existing public course renderer. This does not publish or accept applications. */
export function SalesPlanStandardPreview({ draft, courses, onBack, onMode, children }: {
  draft: SalesPlanDraft; courses: Academy2Course[]; onBack: () => void; onMode?: (mode: 'builder') => void; children?: ReactNode;
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
  const [eventsRefresh, setEventsRefresh] = useState(0);
  useEffect(() => {
    let live = true; setEvents(null); setEventsError('');
    if (draft.configuration.study_style === 'materials_only') { setEvents([]); return; }
    listAcademy2Events(draft.headquarters_id).then(rows => { if (live) setEvents(rows.filter(row => row.sales_plan_id === draft.id)); })
      .catch(cause => { if (live) setEventsError(cause instanceof Error ? cause.message : '開催を読み込めませんでした。'); });
    return () => { live = false; };
  }, [draft.headquarters_id, draft.id, draft.configuration.study_style, retry, eventsRefresh]);
  useEffect(() => {
    let live = true; setPage(null); setError('');
    getSalesPage(draft.headquarters_id, draft.id).then(row => { if (live) setPage(row.revision === 0 ? {...row,blocks:standardSalesPageBlocks(draft,courses)} : row); })
      .catch(cause => { if (live) setError(cause instanceof Error ? cause.message : '販売ページを読み込めませんでした。'); });
    return () => { live = false; };
  }, [draft.headquarters_id, draft.id, draft.revision, retry]);
  const configuration = draft.configuration;
  const price = draft.sale_price_snapshot;
  const ids = configuration.course_ids.length ? configuration.course_ids : draft.course_snapshot.map(course => course.course_id);
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
    <div className={styles.headrow}><header className={styles.title}><h1>販売ページの確認</h1><p>お客様に見えるページ全体を確認できます。</p></header><div className={styles.actions}><button type="button" className={styles.button} aria-pressed={mobile} onClick={()=>setMobile(value=>!value)}>{mobile?'PCで確認':'スマホで確認'}</button><button type="button" className={styles.button} onClick={()=>onMode?.('builder')}>← 編集に戻る</button><button type="button" className={`${styles.button} ${styles.save}`} disabled={saving} onClick={()=>void save()}>{saving?'保存中…':'保存'}</button></div></div>
    <SalesPlanPublicationPanel draft={draft} page={page} onPagePrepared={setPage} onPublished={()=>setEventsRefresh(value=>value+1)}/>
    {saveError && <p role="alert">{saveError}</p>}
    {page.needs_rebase && <p role="status" className={styles.help}>販売プランが更新されています。内容を確認して保存してください。</p>}
    <div className={styles.two}><div className={styles.previewShell}><div className={styles.browser}><div className={styles.browserbar}><span className={styles.dot}/><span className={styles.dot}/><span className={styles.dot}/><span>販売ページのプレビュー</span></div><div className={isStandardSalesPageV5(page.blocks)?v5Styles.page:`${styles.public} ${presentationStyles.page}`} data-mobile={mobile}>
      {!isStandardSalesPageV5(page.blocks)&&<header className={styles.pubTop}>{configuration.title}</header>}
      <h1 className={isStandardSalesPageV5(page.blocks)||salesPageHasVisibleTitle(page.blocks, configuration.title) ? presentationStyles.screenTitle : presentationStyles.planTitle}>{configuration.title}</h1>
      <SalesPlanPageContent blocks={page.blocks} courses={courses.filter(course => ids.includes(course.id))} previewHq={draft.headquarters_id} returnHref={`/academy/h/${draft.headquarters_id}/manage/offerings/${draft.id}?preview=standard`}/>
      <SalesPageBottom draft={draft} events={events} eventsError={eventsError} display={readSalesPageDisplay(page.blocks)} standard={isStandardSalesPageV2(page.blocks)} v5={isStandardSalesPageV5(page.blocks)} onFormPreview={()=>setFormPreview(true)}/>
    </div></div></div><aside><section className={styles.summary}><h2>販売プラン</h2><dl><div><dt>名前</dt><dd>{configuration.title}</dd></div><div><dt>講座</dt><dd>{ids.length}講座</dd></div><div><dt>料金</dt><dd>{priceLabel}</dd></div><div><dt>保存</dt><dd>{page.revision===0?'未保存':page.needs_rebase?'更新を確認':'保存済み'}</dd></div></dl></section><section className={styles.summary}><h2>ページを直す</h2><button type="button" className={styles.button} onClick={()=>onMode?.('builder')}>販売ページを編集</button></section></aside></div>
    {children}<LocalMonthlyReviewEntry draft={draft}/>
    {formPreview && <SalesPlanApplicationPreview headquartersId={draft.headquarters_id} planId={draft.id} configuration={configuration} fields={configuration.application_form?.fields??[]} onClose={()=>setFormPreview(false)}/>}
  </section>;
}
