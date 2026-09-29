"use client";
import { useState } from 'react';
import Link from 'next/link';
import type { InstructorApplicationSummary } from '@/lib/academy2/instructor-operations';
import styles from './instructor-application-list.module.css';
export type InstructorApplicationListItem = InstructorApplicationSummary;
const filters=['対応待ち','日程調整中','入金確認待ち','開講準備','開催確定','完了','すべて'];
const nextNames:Record<string,string>={contact_learner:'受講者への連絡',confirm_schedule:'日程確認',confirm_tuition:'支払い確認',pay_opening_license:'開講ライセンスのお支払い',record_attendance:'出欠確認',completion_report:'修了報告',view_completion_feedback:'本部からの回答確認'};
export function InstructorApplicationList({items}:{items:InstructorApplicationListItem[]}){
 const [search,setSearch]=useState('');const [filter,setFilter]=useState('対応待ち');
 const visible=items.filter(view=>(`${view.learnerName??''} ${view.planTitle??''}`).toLocaleLowerCase().includes(search.toLocaleLowerCase())&&(filter==='すべて'||(filter==='対応待ち'?!!view.nextAction:view.statusLabel===filter)));
 return <section className={styles.wrap}><div className={styles.titlebar}><div className={styles.en}>APPLICATIONS</div><h1>申込</h1></div><div className={styles.headbox}><p>申込後の対応はここで進めます。受講者との連絡、日程、受講料確認、開講ライセンス、開催、修了まで受講者ごとに管理します。</p></div><div className={styles.tools}><input aria-label="名前・講座名で検索" className={styles.search} placeholder="名前・講座名で検索" value={search} onChange={e=>setSearch(e.target.value)}/>{filters.map(value=><button key={value} type="button" aria-pressed={filter===value} className={`${styles.filter} ${filter===value?styles.on:''}`} onClick={()=>setFilter(value)}>{value}</button>)}</div><div className={styles.list}>{visible.map(view=><Link href={`/academy/instructor-applications/${view.applicationId}`} className={styles.application} key={view.applicationId}><span className={styles.avatar}>{Array.from(view.learnerName??'申')[0]}</span><div className={styles.content}><h2>{view.learnerName??'申込者'}</h2><div className={styles.meta}><span>{view.planTitle}</span><span>{view.headquartersName}</span></div></div><div className={styles.right}><span className={styles.status}>{view.statusLabel}</span><div className={styles.next}>{!!view.nextAction?`次：${nextNames[view.nextAction]??'内容を確認'}`:''}</div></div></Link>)}</div>{!visible.length&&<p className={styles.empty}>該当する申込はありません。</p>}</section>;
}

