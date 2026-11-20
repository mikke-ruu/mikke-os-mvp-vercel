import type {ApplicationHistory as History} from '@/lib/academy2/headquarters-applications';
import {applicationDate} from './HeadquartersApplications';
import styles from './applications-operation.module.css';
export function ApplicationHistory({items,heading='対応履歴'}:{items:History[];heading?:string}){
 const labels:Record<string,string>={application_received:'お申し込み',edit_shipping:'発送情報の訂正',undo_shipping:'発送済みを取り消し',undo_completion:'受講完了を取り消し',note:'メモ',confirm_payment:'入金確認',undo_payment:'入金確認を取り消し',confirm_completion:'受講完了',confirm_certification:'認定',set_shipping_destination:'発送先の確認',record_shipping:'発送済み'};
 return <section className={styles.detailCard}><h2>{heading}</h2>{items.length?<ol className={styles.historyList}>{items.map(item=><li key={item.id}><div><strong>{labels[item.action]??'対応を記録'}</strong><span>{applicationDate(item.at)} · {item.actor}</span></div>{item.note&&<p>{item.note}</p>}</li>)}</ol>:<p className={styles.meta}>まだ記録はありません。</p>}</section>;
}
