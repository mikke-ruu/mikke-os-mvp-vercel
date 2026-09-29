import {monthlyInitialPaymentText,monthlyPolicyMessages,monthlyPolicySummary} from '@/lib/academy2/monthly-policy-display.mjs';
import styles from './MonthlyPolicySummary.module.css';

/** Added monthly policy content; UI05 supplies the row density, not these new rules. */
export function MonthlyPolicySummary({monthly,showIssues=false}:{monthly:unknown;showIssues?:boolean}){
 const issues=monthlyPolicyMessages(monthly);
 return <section aria-label="月額レッスンの条件" className={styles.summary}>
  <h3>月額レッスンの条件</h3><p>{monthlyInitialPaymentText}</p>
  <dl>{monthlyPolicySummary(monthly).map(row=><div className={styles.row} key={row.key}><dt>{row.label}</dt><dd>{row.value}{row.notes.map((note,index)=><p key={index}>{note}</p>)}</dd></div>)}</dl>
  {showIssues&&issues.length>0&&<div role="status"><p>未設定の条件があります。このままでは募集を公開できません。</p><ul>{issues.map(issue=><li key={issue.code}>{issue.message}</li>)}</ul></div>}
 </section>;
}
