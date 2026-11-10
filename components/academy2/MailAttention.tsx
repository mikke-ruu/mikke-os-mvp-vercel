'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase/client';
import {listHeadquartersApplications} from '@/lib/academy2/headquarters-applications';
import {toAcademyContextHref} from '@/lib/academy/access-context';
export function MailAttention({hq}:{hq:string}){
 const [rows,setRows]=useState<{id:string;name:string}[]>([]),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setError(false);void(async()=>{try{const apps=(await listHeadquartersApplications(hq)).filter(a=>(!a.source||a.source==='academy2'));const result:{id:string;name:string}[]=[];for(let i=0;i<apps.length;i+=200){const group=apps.slice(i,i+200);const {data,error}=await supabase.rpc('academy2_hq_mail_status',{p_hq:hq,p_applications:group.map(a=>a.applicationId)});if(error)throw error;for(const row of data??[])if(['failed','unknown'].includes(row.participation.state)&&!row.participation.contactedAt)result.push({id:row.applicationId,name:group.find(a=>a.applicationId===row.applicationId)?.applicantName??'受講者'});}if(live)setRows(result);}catch{if(live)setError(true);}})();const refresh=()=>setRetry(v=>v+1);window.addEventListener('focus',refresh);return()=>{live=false;window.removeEventListener('focus',refresh);};},[hq,retry]);
 if(error)return <p role="status">メールの対応状況を確認できませんでした。<button type="button" onClick={()=>setRetry(v=>v+1)}>再確認</button></p>;
 if(!rows.length)return null;
 return <section style={{padding:16,margin:'16px 0',background:'white',border:'1px solid #e8e8eb',borderRadius:12}}><h2 style={{fontSize:18}}>メールの確認が必要です</h2>{rows.map(row=><p key={row.id}><a href={toAcademyContextHref('/academy/applications/'+row.id,hq,'manage')}>{row.name}さんへの参加案内を確認する →</a></p>)}</section>;
}
