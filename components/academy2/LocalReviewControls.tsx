'use client';
import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {localReview,type LocalReviewState} from '@/lib/academy2/local-review';
import styles from './SalesPlanDraftEditor.module.css';
export function LocalReviewControls({headquartersId}:{headquartersId:string}){
 const query=useSearchParams(),[state,setState]=useState<LocalReviewState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function apply(change:{card?:boolean;community?:boolean}){setBusy(true);setError('');try{const next=await localReview(headquartersId,change);setState(next);window.dispatchEvent(new Event('academy-local-review-change'));}catch(e){setError(e instanceof Error?e.message:'確認状態を変更できませんでした。');}finally{setBusy(false);}}
 useEffect(()=>{let live=true;(async()=>{const current=await localReview(headquartersId);if(!live||!current)return;const card=query.get('reviewCard'),community=query.get('reviewCommunity'),change={...(card==='on'||card==='off'?{card:card==='on'}:{}),...(community==='on'||community==='off'?{community:community==='on'}:{})};setState(current);if(Object.entries(change).some(([k,v])=>current[k as 'card'|'community']!==v))await apply(change);})().catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[headquartersId,query.toString()]);
 if(!state)return error?<p role="alert">{error}</p>:null;
 return <section className={styles.localReview} aria-label="ローカル確認状態"><strong>ローカル確認用の契約状態</strong><p>実契約・実課金・招待・参加権の付与は行いません。</p><fieldset disabled={busy}><div role="group" aria-label="決済の確認状態">決済：{[false,true].map(v=><button key={String(v)} type="button" aria-pressed={state.card===v} onClick={()=>void apply({card:v})}>{v?'契約済み':'未契約'}</button>)}</div><div role="group" aria-label="Communityの確認状態">Community：{[false,true].map(v=><button key={String(v)} type="button" aria-pressed={state.community===v} onClick={()=>void apply({community:v})}>{v?'契約済み':'未契約'}</button>)}</div></fieldset>{error&&<p role="alert">{error}</p>}</section>;
}
