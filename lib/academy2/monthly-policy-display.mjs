import {monthlyPolicyIssues} from './monthly-policy.mjs';

// Labels are derived from saved values. No defaults or billing actions occur here.
export const monthlyPolicyReasonLabels={
 billing_policy_required:'請求日を設定してください。指定日は1〜31日で、該当日がない月は末日とします。',
 cancellation_policy_required:'解約の受付方法を設定してください。',
 refund_policy_required:'返金の扱いを設定してください。一部返金の場合は、計算方法や条件の説明も必要です。',
 unpaid_policy_required:'未入金時の猶予を0日以上の整数で設定してください。',
};
export function monthlyPolicyMessages(monthly){
 return monthlyPolicyIssues(monthly).map(issue=>({path:issue.path,code:issue.code,message:monthlyPolicyReasonLabels[issue.code]}));
}
export function monthlyPolicySummary(monthly){
 const issues=monthlyPolicyIssues(monthly);const invalid=key=>issues.some(issue=>issue.path===`monthly.${key}`);
 const b=monthly?.billing_policy,c=monthly?.cancellation_policy,r=monthly?.refund_policy,u=monthly?.unpaid_policy;
 return [
  {key:'billing_policy',label:'請求日',value:invalid('billing_policy')?'未設定または要確認':b.anchor==='join_date'?'申込日と同じ日に毎月請求':b.anchor==='month_start'?'毎月1日に請求':`毎月${b.day}日に請求`,notes:invalid('billing_policy')?[]:['指定日がない月は、その月の末日とします。']},
  {key:'cancellation_policy',label:'解約',value:invalid('cancellation_policy')?'未設定または要確認':c.kind==='before_next_charge'?'次回請求前まで解約可能':'本部への申請後に確認',notes:[]},
  {key:'refund_policy',label:'返金',value:invalid('refund_policy')?'未設定または要確認':r.kind==='no_refund'?'原則返金なし':r.kind==='administrator_review'?'本部が内容を確認して判断':'一部返金',notes:[r?.kind==='partial_refund'&&typeof r.explanation==='string'?r.explanation.trim():'',r?.kind==='administrator_review'&&typeof r.consultation==='string'&&r.consultation.trim()?`相談方法：${r.consultation.trim()}`:''].filter(Boolean)},
  {key:'unpaid_policy',label:'未入金時の猶予',value:invalid('unpaid_policy')?'未設定または要確認':u.grace_days===0?'猶予なし':`${u.grace_days}日間`,notes:[]},
 ];
}

// Changing refund kind explicitly discards the previous kind's explanation/consultation.
export function nextMonthlyRefundPolicy(kind){return kind==='partial_refund'?{kind,explanation:''}:kind==='no_refund'||kind==='administrator_review'?{kind}:undefined;}

export const monthlyInitialPaymentText='申込日に初回分を満額で決済し、決済完了後すぐに受講できます。次回から設定した請求日に請求します。日割り計算は行いません。';
