'use client';
import {useEffect,useState} from 'react';
import {listSalesPlanCatalog,type SalesPlanPublicationState} from '@/lib/academy2/sales-plan-catalog';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import {PublicationStatusCard} from './PublicationStatusCard';
import styles from './publication-flow.module.css';
export function PlanPublicationNotice({headquartersId,planId,revision,disabled=false}:{headquartersId:string;planId:string;revision:number;disabled?:boolean}){
 const [snapshot,setSnapshot]=useState<SalesPlanPublicationState|null>(null),[failed,setFailed]=useState(false),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setSnapshot(null);setLoading(true);setFailed(false);listSalesPlanCatalog(headquartersId).then(rows=>{const value=rows.find(row=>row.id===planId)?.publication;if(!value)throw new Error('not found');if(live)setSnapshot(value);}).catch(()=>{if(live)setFailed(true);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[headquartersId,planId,revision,retry]);
 if(loading)return <p role="status">公開状態を確認中…</p>;
 return <><PublicationStatusCard publication={snapshot} disabled={disabled} reviewHref={toAcademyContextHref('/academy/offerings/'+planId+'?preview=standard',headquartersId,'manage')}/>{(failed||!snapshot||['unknown','unavailable'].includes(snapshot.state))&&<div role="alert"><button type="button" className={styles.button} onClick={()=>setRetry(value=>value+1)}>公開状態を再確認する</button></div>}</>;
}
