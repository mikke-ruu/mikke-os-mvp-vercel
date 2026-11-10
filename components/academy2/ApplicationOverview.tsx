'use client';
import type {ReactNode} from 'react';
import type {HeadquartersApplicationSummary} from '@/lib/academy2/headquarters-applications';
import {applicationScheduleLabel} from '@/lib/academy2/application-schedule';
import {paymentMethodLabel} from '@/lib/academy2/shipment-display';
import {applicationDate,applicationPaymentLabel,nextActionLabel} from './HeadquartersApplications';
import styles from './applications-operation.module.css';
import {ApplicationProgress} from './ApplicationProgress';

/** Present the scoped application record. Never infer purchase facts from today's plan. */
export function ApplicationOverview({summary,plan,venue,materials,assignee,actionAvailable}:{summary:HeadquartersApplicationSummary;plan?:ReactNode;venue?:ReactNode;materials?:ReactNode;assignee?:ReactNode;actionAvailable:boolean}){
 const payment=summary.tuition?applicationPaymentLabel(summary.tuition.status):null;
 const task=summary.completedAt&&!summary.nextAction?'対応は完了しています':summary.nextAction==='confirm_payment'?(summary.tuition?.method==='bank'?'銀行口座への入金を確認する':summary.tuition?.method==='external'?'決済サービスで支払いを確認する':'受講料の受け取りを確認する'):['record_shipping','ship_kit'].includes(summary.nextAction??'')?'教材・材料を発送する':summary.nextAction==='set_shipping_destination'?'発送先を確認する':['confirm_certification','review_outcome'].includes(summary.nextAction??'')?'認定機能は準備中です':summary.nextAction?nextActionLabel(summary.nextAction):'現在の対応状況を確認してください';
 return <section className={styles.applicationOverview} aria-label="お申し込みの概要">
  <ApplicationProgress summary={summary}/>
  <div className={styles.overviewTop}><span>お申し込みの概要</span><div className={styles.overviewStatuses} aria-label="現在の状況"><span className={styles.overviewState} data-pending={summary.tuition?.status==='pending'}>{summary.statusLabel==='修了'?'受講完了':summary.statusLabel||'状況を確認してください'}</span>{payment&&payment!==summary.statusLabel&&<span className={styles.paymentState}>{payment}</span>}</div></div>
  <h2 className={styles.overviewPlan}>{plan??summary.planTitle}</h2><p className={styles.overviewApplicant}>{summary.applicantName}さんのお申し込み</p>
  <dl className={styles.overviewDetails}><div className={styles.overviewSchedule}><dt>開催日時</dt><dd>{applicationScheduleLabel(summary.schedule)}</dd>{venue&&<dd className={styles.overviewVenue}>{venue}</dd>}</div><div className={styles.overviewAmount}><dt>受講料</dt><dd>{summary.tuition?new Intl.NumberFormat('ja-JP',{style:'currency',currency:summary.tuition.currency||'JPY'}).format(summary.tuition.amount):'金額の閲覧権限がありません'}</dd></div></dl>
  {(materials||assignee)&&<dl className={styles.overviewMeta}>{materials&&<div><dt>教材・材料</dt><dd>{materials}</dd></div>}{assignee&&<div><dt>担当者</dt><dd>{assignee}</dd></div>}</dl>}
  <dl className={styles.overviewMeta}><div><dt>申込日時</dt><dd>{applicationDate(summary.appliedAt)}</dd></div>{summary.tuition&&<div><dt>お支払い方法</dt><dd>{paymentMethodLabel(summary.tuition.method)}</dd></div>}</dl>
  <div className={styles.overviewNext}><div><span>{summary.completedAt&&!summary.nextAction?'対応状況':'次にすること'}</span><p>{task}</p></div>{actionAvailable&&summary.nextAction&&!['confirm_certification','review_outcome'].includes(summary.nextAction)&&<button type="button" onClick={()=>document.getElementById('application-operations')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}>対応へ進む <span aria-hidden="true">↓</span></button>}</div>
 </section>;
}
