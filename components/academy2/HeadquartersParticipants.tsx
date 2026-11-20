'use client';
import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {useAcademy2Headquarters} from './HeadquartersBoundary';
import {toAcademyContextHref} from '@/lib/academy/access-context';
import {listParticipants,getParticipant,type AcademyParticipant} from '@/lib/academy2/headquarters-applications';
import {applicationDate,applicationCompleted,applicationPaymentLabel} from './HeadquartersApplications';
import {applicationScheduleLabel} from '@/lib/academy2/application-schedule';
import {ApplicationThumbnail} from './ApplicationThumbnail';
import {ApplicationHistory} from './ApplicationHistory';
import {ApplicationMailStatus} from './ApplicationMailStatus';
import {InternalNoteEditor} from './InternalNoteEditor';
import styles from './applications-operation.module.css';
export function HeadquartersParticipants(){
 const hq=useAcademy2Headquarters(),params=useSearchParams(),person=params.get('person');
 const[rows,setRows]=useState<AcademyParticipant[]|null>(null),[selected,setSelected]=useState<AcademyParticipant|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[search,setSearch]=useState(params.get('q')??'');
 useEffect(()=>{if(!hq)return;let live=true;setError('');setSelected(null);setRows(null);(person?getParticipant(hq.id,person):listParticipants(hq.id)).then(result=>{if(live){if(Array.isArray(result))setRows(result);else setSelected(result);}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'受講者を読み込めませんでした。');});return()=>{live=false;};},[hq?.id,person,retry]);
 if(!hq)return null;const href=(path:string)=>toAcademyContextHref(path,hq.id,'manage');const listHref=href('/academy/participants'+(search?'?q='+encodeURIComponent(search):''));
 return <div className={styles.wrap}>{person&&<a className={styles.backLink} href={listHref}>← 受講者一覧へ戻る</a>}<div className={styles.heroTitle}><div className={styles.en}>PARTICIPANTS</div><h1 className={styles.jp}>{person?'受講者詳細':'受講者一覧'}</h1></div><div className={styles.heroBody}><p>{person?'これまでの受講履歴と運営メモを確認できます。':'申込のある方を、受講履歴と一緒に確認できます。'}</p><button type="button" className={styles.iconButton} aria-label="受講者情報を更新" onClick={()=>setRetry(v=>v+1)}>↻</button></div>
 {error?<div role="alert" className={styles.error}>{error}<button type="button" className={styles.button} onClick={()=>setRetry(v=>v+1)}>再読み込み</button></div>:!rows&&!selected?<p role="status">読み込み中…</p>:null}
 {!person&&<><div className={styles.toolbar}><input className={styles.input} aria-label="受講者・講座名で検索" placeholder="受講者・講座名で検索" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className={styles.list}>{rows?.filter(row=>[row.name,...row.applications.map(a=>a.planTitle)].join(' ').toLocaleLowerCase('ja-JP').includes(search.trim().toLocaleLowerCase('ja-JP'))).map(row=><a className={styles.linkCard+' '+styles.participantCard} href={href('/academy/participants?person='+encodeURIComponent(row.key)+(search?'&q='+encodeURIComponent(search):''))} key={row.key}><h2>{row.name}さん</h2><p>申込 {row.applications.length}件 · 受講完了 {row.completedCount}件</p><p className={styles.meta}>最近の申込：{row.applications[0]?.planTitle}</p><span className={styles.textLink}>受講履歴を見る →</span></a>)}</div>{rows?.length===0&&<p className={styles.empty}>まだ受講者はいません。</p>}</>}
 {selected&&<div className={styles.finalDetail}><section className={styles.detailCard}><h2>{selected.name}さん</h2>{selected.contactEmail&&<p className={styles.participantEmail}>{selected.contactEmail}</p>}<p>申込 {selected.applications.length}件 · 受講完了 {selected.completedCount}件</p>{selected.key.startsWith('unlinked:')&&<p>アカウントを確認できない過去の申込です。他の申込と自動でまとめていません。</p>}</section><section className={styles.detailCard}><h2>受講履歴</h2><div className={styles.list}>{selected.applications.map(row=><a key={row.applicationId} className={styles.linkCard+' '+styles.applicationCard} href={href('/academy/applications/'+row.applicationId+'?fromParticipant='+encodeURIComponent(selected.key))}><ApplicationThumbnail src={row.thumbnailUrl}/><div className={styles.applicationCardBody}><h3>{row.planTitle}</h3><p className={styles.scheduleLine}>{applicationScheduleLabel(row.schedule)}</p><div className={styles.responseLine}>{row.tuition&&<span className={styles.stateBadge}>{applicationPaymentLabel(row.tuition.status)}</span>}<span>{applicationCompleted(row)?'受講完了':'受講完了前'}</span></div>{row.completedAt&&<p className={styles.meta}>受講完了：{applicationDate(row.completedAt)}</p>}<p className={styles.meta}>申込：{applicationDate(row.appliedAt)}</p></div><span className={styles.cardDetail}>申込詳細 →</span></a>)}</div></section>
 {selected.applications.filter(row=>(!row.source||row.source==='academy2')).map(row=><ApplicationMailStatus key={row.applicationId} hq={hq.id} applicationId={row.applicationId} planTitle={row.planTitle}/>)}<section className={styles.detailCard}><h2>受講者のメモ</h2>{selected.canWriteNote?<InternalNoteEditor key={selected.key} hq={hq.id} subject={selected.key} participant onSaved={notes=>setSelected({...selected,notes})}/>:<p>運営担当の方がメモを記入できます。</p>}</section><ApplicationHistory items={selected.notes??[]} heading="受講者のメモ履歴"/>
 <p className={styles.meta}>認定の付与と講師としての活動開始は、別の手続きです。</p></div>}
 </div>;
}
