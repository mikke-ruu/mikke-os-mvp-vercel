'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {getAcademy2Management,type ManagementState} from '@/lib/academy2/management';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import styles from './headquarters-settings.module.css';

/** A saved draft is not an active public offer. Never infer publication from an event. */
export function PlanPublicationNotice({headquartersId,planId,revision,disabled=false}:{headquartersId:string;planId:string;revision:number;disabled?:boolean}){
 const [snapshot,setSnapshot]=useState<ManagementState|null>(null),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setSnapshot(null);setFailed(false);getAcademy2Management(headquartersId,'plan',planId).then(value=>{if(live)setSnapshot(value);}).catch(()=>{if(live)setFailed(true);});return()=>{live=false;};},[headquartersId,planId,revision,retry]);
 if(failed)return <div role="alert" className={styles.note}>公開状態を確認できませんでした。<button type="button" className={styles.btn} onClick={()=>setRetry(value=>value+1)}>再確認</button></div>;
 if(!snapshot)return <p role="status" className={styles.help}>公開状態を確認中…</p>;
 return <section aria-label="保存と公開の状態" className={styles.note}>
  <p>{snapshot.state==='published'?'公開版があります。編集中の内容を保存しても、公開版は自動更新されません。':'設定は保存されていますが、現在は募集ページが公開されていません。開催を「受付中」にしても、販売プランを公開するまで申し込めません。'}</p>
  <Link aria-disabled={disabled} onClick={event=>{if(disabled)event.preventDefault();}} className={styles.linkRow} href={toAcademyContextHref(`/academy/offerings/${planId}?preview=standard`,headquartersId,'manage')}>販売ページと公開条件を確認する →</Link>
  {disabled&&<p>変更を保存してから公開条件を確認してください。</p>}
 </section>;
}
