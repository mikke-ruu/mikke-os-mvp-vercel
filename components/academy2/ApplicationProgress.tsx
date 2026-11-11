import type {HeadquartersApplicationSummary} from '@/lib/academy2/headquarters-applications';
import styles from './applications-operation.module.css';
export function ApplicationProgress({summary}:{summary:HeadquartersApplicationSummary}){
 const complete=!!summary.completedAt||summary.completed===true;
 const paid=complete||['paid','confirmed','not_required'].includes(summary.tuition?.status??'');
 const shipment=summary.fulfillment?.required===true,steps=shipment?['申込受付','入金確認','教材発送','受講','受講完了']:['申込受付','入金確認','受講','受講完了'];
 const index=complete?steps.length-1:!paid?1:shipment&&!summary.fulfillment?.shipped?2:steps.length-2,visible=!!summary.tuition||complete;
 return <nav className={styles.applicationProgress} aria-label="受講の進捗"><ol style={{gridTemplateColumns:`repeat(${steps.length},minmax(0,1fr))`}}>{steps.map((label,i)=><li key={label} data-done={complete||i<index} aria-current={visible&&i===index?'step':undefined}><span aria-hidden="true">{complete||i<index?'✓':i+1}</span><div>{label}{visible&&i===index&&!complete&&<small>現在</small>}</div></li>)}</ol>{!summary.tuition&&!complete&&<p>入金状況は閲覧権限がある方が確認できます。</p>}</nav>;
}
