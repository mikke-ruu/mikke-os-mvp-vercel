'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {getAcademy2EventRegistrationSource,type EventRegistrationSource} from '@/lib/academy2/operations';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import styles from './headquarters-settings.module.css';

/** Read the authoritative public-source check, without changing registration. */
export function EventRecruitmentNotice({headquartersId,eventId,planId,revision,disabled=false}:{headquartersId:string;eventId:string;planId:string|null;revision:number|null;disabled?:boolean}){
 const [source,setSource]=useState<EventRegistrationSource|null>(null),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setSource(null);setFailed(false);getAcademy2EventRegistrationSource(headquartersId,eventId).then(value=>{if(live)setSource(value);}).catch(()=>{if(live)setFailed(true);});return()=>{live=false;};},[headquartersId,eventId,revision,retry]);
 if(failed)return <div role="alert" className={styles.note}>申込受付の条件を確認できませんでした。<button type="button" className={styles.btn} onClick={()=>setRetry(value=>value+1)}>再確認</button></div>;
 if(!source)return <p role="status" className={styles.help}>販売プランの公開条件を確認中…</p>;
 if(source.ready)return null;
 return <div role="status" className={styles.note}><p>{source.reasons.includes('plan_not_published')?'販売プランが未公開のため、お客様はまだ申し込めません。開催の受付設定と、募集ページの公開は別の設定です。':'公開条件が整っていないため、現在の受付設定だけでは申し込めません。開催詳細で不足項目を確認してください。'}</p>{planId&&<Link aria-disabled={disabled} onClick={event=>{if(disabled)event.preventDefault();}} className={styles.linkRow} href={toAcademyContextHref(`/academy/offerings/${planId}?preview=standard`,headquartersId,'manage')}>販売ページと公開条件を確認する →</Link>}{disabled&&<p>変更を保存してから公開条件を確認してください。</p>}</div>;
}
