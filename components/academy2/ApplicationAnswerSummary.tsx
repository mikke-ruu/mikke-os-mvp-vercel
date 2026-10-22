"use client";
import {useEffect,useState,type ReactNode} from 'react';
import {useAuth} from '@/components/AuthGate';
import {supabase} from '@/lib/supabase/client';
import styles from './applications-operation.module.css';
import type {IntakeField} from '@/lib/academy2/application-conditions.mjs';

type Snapshot={fields:IntakeField[];answers:Record<string,string>;savedAt?:string;legacy:boolean};
type BasicRow={id:string;label:string;value?:ReactNode};
/** Display the immutable question array in its saved order, never the current form. */
export function ApplicationAnswerSummary({applicationId,className,basicRows,reservedAnswers={}}:{applicationId:string;className?:string;basicRows?:BasicRow[];reservedAnswers?:Record<string,string|undefined>}) {
 const {user}=useAuth();const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setData(null);setError('');void Promise.resolve(supabase.rpc('academy2_application_answers',{p_application:applicationId}).abortSignal(AbortSignal.timeout(30000))).then(({data,error})=>{if(!live)return;if(error)setError('申込時の回答を読み込めませんでした。');else setData(data as Snapshot);}).catch(()=>{if(live)setError('申込時の回答を読み込めませんでした。');});return()=>{live=false;};},[applicationId,user.id,retry]);
 const fields=data?.fields??[],answers=data?.answers??{};
 const basicById=new Map(basicRows?.map(row=>[row.id,row])??[]);
 const ordered=!!data&&!data.legacy&&fields.length>0;
 // Metadata is separate. Form answers, including name/email/phone, follow the immutable field array.
 const metadata=ordered?basicRows?.filter(row=>!fields.some(field=>field.id===row.id)&&row.id!=='phone'):basicRows;
 const answer=(field:IntakeField)=>Object.hasOwn(answers,field.id)?answers[field.id]:reservedAnswers[field.id];
 const unknown=Object.keys(answers).filter(id=>!fields.some(field=>field.id===id));
 return <section className={`${className??styles.detailCard} ${styles.answers}`}><h2>{basicRows?'お申し込み内容':'申込時の回答'}</h2>
 {metadata&&<dl className={styles.basicAnswers}>{metadata.map(row=>{const field=fields.find(field=>field.id===row.id);if(row.id==='phone'&&!field&&!Object.hasOwn(answers,'phone'))return null;return <div className={styles.row} key={row.id}><dt className={styles.rowLabel}>{field?.label??row.label}</dt><dd className={styles.rowValue}>{row.id==='phone'?(answers.phone??''):row.value}</dd></div>;})}</dl>}
 {error?<p role="alert">{error}<button type="button" className={styles.iconButton} aria-label="申込時の回答を再取得" onClick={()=>setRetry(v=>v+1)}>↻</button></p>:!data?<p role="status">回答を読み込んでいます…</p>:data.legacy?<p>この申込には追加質問の回答記録がありません。</p>:<dl className={styles.questionAnswers}>{fields.map(field=>{const value=basicById.get(field.id)?.value??answer(field),missing=field.required&&!value;return <div key={field.id}><dt className={styles.answerLabel}>{field.label}</dt><dd className={styles.answerValue}>{value||<span aria-label="回答なし">&nbsp;</span>}{missing&&<p className={styles.missingAnswer}>{field.id==='terms'?'同意記録の読み取りを確認できません。':'必須回答の記録を確認できません。'}</p>}</dd></div>;})}{unknown.map(id=><div key={id}><dt className={styles.answerLabel}>質問名の記録がない回答（{id}）</dt><dd className={styles.answerValue}>{answers[id]}</dd></div>)}</dl>}
 </section>;
}
