"use client";
import {useEffect,useState} from 'react';
import {getMyAcademy2Materials,type Academy2LearnerMaterials} from '@/lib/academy2/learner-operations';
import styles from './learner-material-status.module.css';
export function LearnerMaterialStatus({applicationId}:{applicationId:string}){
 const [value,setValue]=useState<Academy2LearnerMaterials|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setValue(null);setLoading(true);setError('');getMyAcademy2Materials(applicationId).then(next=>{if(live)setValue(next);}).catch(cause=>{if(live)setError(cause instanceof Error?cause.message:'物品・発送情報を読み込めませんでした。');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[applicationId,retry]);
 const method=value?.method==='venue_handover'?'当日、会場で手渡し':value?.method==='designated_shipping'?'会場・担当者などの指定先へ発送':value?.method==='learner_shipping'?'受講者本人へ発送':'受け渡し方法は未確認です。';
 const shipment=value?.status==='shipped'?'発送済み':value?.status==='preparing'?'発送準備中':null;
 const date=value?.shipped_at&&Number.isFinite(Date.parse(value.shipped_at))?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric'}).format(new Date(value.shipped_at)):null;
 return <section className={styles.panel} aria-label="材料・キットの受け取り"><h2>材料・キットの受け取り</h2>{loading?<p role="status">物品・発送情報を読み込んでいます…</p>:error?<div role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(x=>x+1)}>もう一度読み込む</button></div>:!value?<p>この申込の物品・発送情報は未確認です。</p>:!value.enabled?<p>受講者へ渡す物品はありません。</p>:<><ul>{value.items.map((item,index)=><li key={`${item.course_id}-${index}`}><strong>{item.name}</strong>{item.contents&&<p>{item.contents}</p>}</li>)}</ul><p><span className={styles.label}>受け渡し方法</span>{method}</p>{shipment&&value.method!=='venue_handover'&&<p><span className={styles.label}>発送状況</span><span className={styles.badge}>{shipment}</span>{date&&<span>（{date}）</span>}</p>}{value.method==='learner_shipping'&&value.status==='shipped'&&value.tracking_number&&<p><span className={styles.label}>追跡番号</span><span className={styles.tracking}>{value.tracking_number}</span></p>}</>}</section>;
}
