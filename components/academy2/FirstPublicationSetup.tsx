'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase/client';
import {AcademyFirstPublicationEnrollment} from '@/components/academy/AcademyFirstPublicationEnrollment';
import {getFirstPublicationState,type FirstPublicationState} from '@/lib/academy2/plan-publication';
export function FirstPublicationSetup({headquartersId}:{headquartersId:string}){
 const [state,setState]=useState<FirstPublicationState|null>(null),[userId,setUserId]=useState(''),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let live=true;setError('');Promise.all([getFirstPublicationState(headquartersId),supabase.auth.getUser()]).then(([value,user])=>{if(!user.data.user)throw new Error('ログイン状態を確認してください。');if(live){setState(value);setUserId(user.data.user.id);}}).catch(cause=>{if(live)setError(cause.message);});return()=>{live=false;};},[headquartersId,revision]);
 if(error)return <p role="alert">{error}<button type="button" onClick={()=>setRevision(n=>n+1)}>再確認</button></p>;
 if(!state||!userId)return <p role="status">初公開の契約状態を確認しています…</p>;
 if(state.first_published_at)return <p>初公開日：{new Date(state.first_published_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}。再公開で無料期間は変更されません。</p>;
 if(state.consented&&state.phase==='prepared')return <p role="status">利用契約の準備ができました。販売ページから募集を公開できます。無料期間は、初めて申込可能な募集を公開した時点から始まります。</p>;
 if(!state.can_consent)return <p>初公開の利用契約は本部責任者が確認します。</p>;
 if(state.phase!=='unprepared'&&state.phase!=='prepared')return <p>既存の利用契約を維持します。今回の初公開手続きは適用しません。</p>;
 return <AcademyFirstPublicationEnrollment academy2 userId={userId} headquartersId={headquartersId} policyVersion="academy-first-publication-trial-2026-09-08-v1" termsRevision="academy-first-publication-trial-terms-2026-09-08-v1" termsHref="/legal/academy/first-publication-trial/2026-09-08-v1" billingHref="/legal/academy/billing/2026-09-04-v1" onPrepared={()=>{setRevision(n=>n+1);}}/>;
}
