'use client';
import {useState} from 'react';
import type {SalesPlanDraftConfiguration} from '@/lib/academy2/sales-plan-drafts';
import {monthlyInitialPaymentText,monthlyPolicyMessages,nextMonthlyRefundPolicy} from '@/lib/academy2/monthly-policy-display.mjs';
import styles from './SalesPlanDraftEditor.module.css';

type Monthly=NonNullable<SalesPlanDraftConfiguration['monthly']>;
type PolicyKey='billing_policy'|'cancellation_policy'|'refund_policy'|'unpaid_policy';
export function MonthlyPolicyFields({monthly,onChange,isNewDraft}:{monthly:Monthly;onChange:(value:Monthly)=>void;isNewDraft:boolean}){
 const [customGrace,setCustomGrace]=useState(false);
 const set=(value:Partial<Monthly>)=>onChange({...monthly,...value});
 const clear=(key:PolicyKey)=>{const next={...monthly};delete next[key];onChange(next);};
 const billing=monthly.billing_policy,refund=monthly.refund_policy;
 const grace=monthly.unpaid_policy?.grace_days;
 const custom=customGrace||(grace!==undefined&&![0,3,7].includes(grace));
 const issues=monthlyPolicyMessages(monthly);
 return <section aria-label="月額の請求・解約条件">
  <p>{isNewDraft?'おすすめ初期値を入れています。各項目は変更できます。':'保存済みの設定を表示しています。未設定の項目は自動で補完しません。'}</p>
  <p>{monthlyInitialPaymentText}</p>
  <div className={styles['customer-field']}><label htmlFor="monthly-billing">請求日</label><select id="monthly-billing" value={billing?.anchor??''} onChange={e=>{const anchor=e.target.value;if(anchor==='join_date'||anchor==='month_start')set({billing_policy:{anchor,short_month:'last_day'}});else if(anchor==='day_of_month')set({billing_policy:{anchor,day:0,short_month:'last_day'}});else clear('billing_policy');}}><option value="">未設定</option><option value="join_date">申込日と同じ日に毎月請求</option><option value="month_start">毎月1日に請求</option><option value="day_of_month">毎月の請求日を指定</option></select></div>
  {billing?.anchor==='day_of_month'&&<div className={styles['customer-field']}><label htmlFor="monthly-billing-day">請求日（1〜31日）</label><input id="monthly-billing-day" type="number" min="1" max="31" step="1" value={billing.day||''} onChange={e=>set({billing_policy:{anchor:'day_of_month',day:e.target.value===''?0:Number(e.target.value),short_month:'last_day'}})}/></div>}
  <p>指定日がない月は、その月の末日とします。</p>
  <div className={styles['customer-field']}><label htmlFor="monthly-cancellation">解約の受付</label><select id="monthly-cancellation" value={monthly.cancellation_policy?.kind??''} onChange={e=>{const kind=e.target.value;if(kind==='before_next_charge'||kind==='administrator_review')set({cancellation_policy:{kind}});else clear('cancellation_policy');}}><option value="">未設定</option><option value="before_next_charge">次回請求前まで解約可能</option><option value="administrator_review">本部への申請後に確認</option></select></div>
  <div className={styles['customer-field']}><label htmlFor="monthly-refund">返金の扱い</label><select id="monthly-refund" value={refund?.kind??''} onChange={e=>{const next=nextMonthlyRefundPolicy(e.target.value);if(next)set({refund_policy:next});else clear('refund_policy');}}><option value="">未設定</option><option value="no_refund">原則返金なし</option><option value="administrator_review">本部が内容を確認して判断</option><option value="partial_refund">一部返金</option></select></div>
  {refund?.kind==='partial_refund'&&<div className={styles['customer-field']}><label htmlFor="monthly-refund-explanation">{refund.kind==='partial_refund'?'返金の計算方法・条件（必須）':'返金・例外の説明（任意）'}</label><textarea id="monthly-refund-explanation" required={refund.kind==='partial_refund'} value={refund.explanation??''} onChange={e=>set({refund_policy:{...refund,explanation:e.target.value}})}/></div>}
  {refund?.kind==='no_refund'&&<p>例外の扱いがある場合は、プラン説明に明記してください。</p>}
  {refund?.kind==='administrator_review'&&<div className={styles['customer-field']}><label htmlFor="monthly-refund-consultation">返金の相談方法（任意）</label><textarea id="monthly-refund-consultation" value={refund.consultation??''} onChange={e=>set({refund_policy:{...refund,consultation:e.target.value}})}/></div>}
  <div className={styles['customer-field']}><label htmlFor="monthly-unpaid">未入金時の猶予</label><select id="monthly-unpaid" value={custom?'custom':grace??''} onChange={e=>{if(e.target.value==='custom'){setCustomGrace(true);clear('unpaid_policy');}else{setCustomGrace(false);if(e.target.value==='')clear('unpaid_policy');else set({unpaid_policy:{grace_days:Number(e.target.value)}});}}}><option value="">未設定</option><option value="0">猶予なし</option><option value="3">3日間</option><option value="7">7日間</option><option value="custom">日数を指定</option></select></div>
  {custom&&<div className={styles['customer-field']}><label htmlFor="monthly-grace-days">猶予日数（0日以上）</label><input id="monthly-grace-days" type="number" min="0" max="2147483647" step="1" value={grace??''} onChange={e=>e.target.value===''?clear('unpaid_policy'):set({unpaid_policy:{grace_days:Number(e.target.value)}})}/></div>}
  {issues.length>0&&<div role="status"><p>未設定の条件がある場合、下書きは保存できますが募集は公開できません。入力途中の指定日や返金説明は、内容を整えてから保存してください。</p><ul>{issues.map(issue=><li key={issue.code}>{issue.message}</li>)}</ul></div>}
 </section>;
}
