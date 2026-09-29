"use client";
import {useEffect,useState} from 'react';
import {useAuth} from '@/components/AuthGate';
import {supabase} from '@/lib/supabase/client';
import type {IntakeField} from '@/lib/academy2/application-conditions.mjs';
type Snapshot={fields:IntakeField[];answers:Record<string,string>;savedAt?:string;legacy:boolean};
/** Permission-checked immutable intake snapshot; never repurposed as an address consent. */
export function ApplicationAnswerSummary({applicationId}:{applicationId:string}) {
 const {user}=useAuth();const [data,setData]=useState<Snapshot|null>(null);const [error,setError]=useState('');
 useEffect(()=>{let live=true;setData(null);setError('');void Promise.resolve(supabase.rpc('academy2_application_answers',{p_application:applicationId})).then(({data,error})=>{if(!live)return;if(error)setError('申込時の回答を確認できませんでした。');else setData(data as Snapshot);}).catch(()=>{if(live)setError('申込時の回答を確認できませんでした。');});return()=>{live=false;};},[applicationId,user.id]);
 return <section className="space-y-3 rounded-xl border border-[var(--mikke-line)] bg-white p-4"><h2 className="text-sm font-bold">申込時の回答</h2>{error?<p role="alert">{error}</p>:!data?<p role="status">回答を読み込んでいます…</p>:data.legacy?<p className="text-xs">この申込には追加質問の回答記録がありません。</p>:<dl className="space-y-3">{data.fields.filter(field=>Object.hasOwn(data.answers,field.id)).map(field=><div key={field.id}><dt className="text-xs font-bold">{field.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{data.answers[field.id]||'未入力'}</dd></div>)}</dl>}<p className="text-xs text-[var(--mikke-muted)]">申込時の内容です。発送先や証書記載名の確定操作とは別に確認してください。</p></section>;
}
