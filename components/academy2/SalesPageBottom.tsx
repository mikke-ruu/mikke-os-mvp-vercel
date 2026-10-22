import type { SalesPlanDraft } from '@/lib/academy2/sales-plan-drafts';
import {useEffect,useState} from 'react';
import {getAcademy2Event} from '@/lib/academy2/operations';
import type { Academy2EventSummary,Academy2EventDetail } from '@/lib/academy2/operations';
import {readEventMaterials} from '@/lib/academy2/material-fulfillment';
import type { SalesPageDisplay } from '@/lib/academy2/sales-page-display';
import { SalesPresentation, SalesPresentationSection, SalesPresentationEvents } from './SalesPagePresentation';
import styles from './sales-page-presentation.module.css';
import {SalesApplicationFlow} from './SalesApplicationFlow';
import {StandardV5Information} from './StandardSalesPageV5';
import v5Styles from './standard-sales-page-v5.module.css';

export function SalesPageBottom({ draft, events, eventsError, display, onFormPreview, standard=false,v5=false,previewEvent }: {
  draft: SalesPlanDraft; events: Academy2EventSummary[] | null; eventsError?: string;
  display: SalesPageDisplay; onFormPreview: () => void; standard?:boolean;v5?:boolean;previewEvent?:Academy2EventDetail;
}) {
  const [eventMethods,setEventMethods]=useState<Record<string,string|null>>({});
  const [methodError,setMethodError]=useState(false);
  const previewKey=previewEvent?`${draft.headquarters_id}:${draft.id}:${draft.revision}:${previewEvent.id}:${previewEvent.revision}`:null;
  const [previewState,setPreviewState]=useState<{key:string;delivery:string|null;error:string|null}|null>(null);
  useEffect(()=>{let live=true;setPreviewState(null);if(!previewEvent||!previewKey)return;const run=async()=>{try{
   let delivery:string|null=previewEvent.kit_method;
   if(draft.configuration.kit?.enabled&&previewEvent.kit_settings.contract_version===2){const value=await readEventMaterials(draft.headquarters_id,previewEvent.id);if(!value)throw new Error('保存済みの受け渡し設定を確認できませんでした。');delivery=value.method;}
   const current=await getAcademy2Event(draft.headquarters_id,previewEvent.id);
   if(current.id!==previewEvent.id||current.headquarters_id!==draft.headquarters_id||current.sales_plan_id!==draft.id||current.plan_revision!==draft.revision||current.revision!==previewEvent.revision)throw new Error('開催が更新されています。保存済みの内容を読み直してから確認してください。');
   if(live)setPreviewState({key:previewKey,delivery,error:null});
  }catch(cause){if(live)setPreviewState({key:previewKey,delivery:null,error:cause instanceof Error?cause.message:'開催の保存状態を確認できませんでした。'});}};void run();return()=>{live=false;};},[previewKey,draft.configuration.kit?.enabled]);
  useEffect(()=>{let live=true;setEventMethods({});setMethodError(false);if(!previewEvent&&v5&&draft.configuration.kit?.enabled&&events){void Promise.all(events.filter(event=>event.registration_status==='open').map(async event=>{const detail=await getAcademy2Event(draft.headquarters_id,event.id);return [event.id,detail.kit_method] as const;})).then(rows=>{if(live)setEventMethods(Object.fromEntries(rows));}).catch(()=>{if(live)setMethodError(true);});}return()=>{live=false;};},[v5,draft.headquarters_id,draft.configuration.kit?.enabled,events,previewEvent?.id]);
  const config = draft.configuration;
  const price = draft.sale_price_snapshot;
  const ids = config.course_ids.length ? config.course_ids : draft.course_snapshot.map(course => course.course_id);
  const amount = price.purchase_mode === 'staged'
    ? ids.length && ids.every(id => typeof price.stage_prices[id] === 'number') ? ids.reduce((sum, id) => sum + price.stage_prices[id]!, 0) : null
    : price.price;
  if(previewEvent&&previewState?.key!==previewKey)return <p role="status">保存済みの開催内容を確認中…</p>;
  if(previewEvent&&previewState?.error)return <p role="alert">{previewState.error}</p>;
  const previewDelivery=previewState?.delivery??null;
  // The management RPC also returns drafts and closed events. They are never learner schedule cards.
  const visibleEvents = previewEvent?[previewEvent]:events?.filter(event => event.registration_status === 'open') ?? [];
  if(v5)return <div className={v5Styles.page} style={{border:0,margin:0}}>{eventsError&&<p role="alert">開催日程を読み込めませんでした。</p>}{methodError&&<p role="alert">教材・キットの受け渡し方法を読み込めませんでした。</p>}<StandardV5Information price={amount} events={visibleEvents.map(event=>({id:event.id,title:event.title,startsAt:event.starts_at,endsAt:event.ends_at,scheduleMode:event.schedule_mode,format:event.format,kitMethod:previewEvent?previewEvent.kit_method:eventMethods[event.id],deliveryMethod:previewEvent?previewDelivery:null,registrationStatus:previewEvent?event.registration_status:undefined}))} paymentMethods={config.payment_methods??[]} materialsOnly={config.study_style==='materials_only'} kit={config.kit} termsBody={config.terms?.body} onApply={onFormPreview} previewOnly={!!previewEvent} unavailable={!!previewEvent&&previewEvent.registration_status!=='open'}/></div>;
  const schedule=(config.study_style==='materials_only'?standard&&<SalesPresentationSection id="sales-page-schedule" heading="受講方法"><p>動画・PDF・文章などの教材を使って、ご自身で学びます。</p></SalesPresentationSection>:(standard||eventsError||events===null||visibleEvents.length>0)&&<SalesPresentationSection id="sales-page-schedule" heading={standard?'受講方法・日程':display.scheduleHeading}>
    {previewEvent&&<p>下記は保存済みの開催内容です。</p>}{eventsError?<p role="alert">開催日程を読み込めませんでした。</p>:events===null&&!previewEvent?<p>開催日程を読み込み中…</p>:<SalesPresentationEvents events={visibleEvents.map(event=>({id:event.id,title:event.title,startsAt:event.starts_at,scheduleMode:event.schedule_mode,format:event.format}))}/>}
  </SalesPresentationSection>);
  return <SalesPresentation display={display}>
    {standard&&schedule}
    <SalesPresentationSection id="sales-page-price" heading={display.priceHeading} align={display.priceAlign}>
      <div style={{textAlign:display.priceAlign}}><p className={styles.price}>{amount === null ? '料金未設定' : `¥${amount.toLocaleString('ja-JP')}`}</p>
      {price.purchase_mode === 'staged' && <ul className={styles.lines}>{ids.map(id => {
        const course = draft.course_snapshot.find(item => item.course_id === id);
        return <li key={id}>{course?.title ?? '講座'}：{price.stage_prices[id] == null ? '未設定' : `¥${price.stage_prices[id]!.toLocaleString('ja-JP')}`}</li>;
      })}</ul>}</div>
      {config.terms?.body && <details className={styles.terms}><summary>お申し込みに関する注意事項</summary><p>{config.terms.body}</p></details>}
    </SalesPresentationSection>
    {!standard&&schedule}
    {standard&&<SalesApplicationFlow paymentMethods={config.payment_methods??[]} materialsOnly={config.study_style==='materials_only'} arranged={visibleEvents.some(event=>event.schedule_mode==='arranged_after_application')}/>}
    <SalesPresentationSection id="apply" heading={display.applicationHeading}>
      <button type="button" className={styles.cta} onClick={onFormPreview}>申込フォームを確認する</button>
    </SalesPresentationSection>
  </SalesPresentation>;
}
