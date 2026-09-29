"use client";
import {useEffect, useState} from 'react';

import {AuthGate, useAuth} from '@/components/AuthGate';
import {listMyAcademy2Applications, type Academy2LearnerApplication as Application} from '@/lib/academy2/learner-operations';
import {safeMeetingUrl, scheduleGroup, scheduleStatus} from '@/lib/academy2/learner-schedule';
import styles from './learner-schedule.module.css';
import homeStyles from './learner-home.module.css';
// SVG geometry copied verbatim from UI26 v0.5 mobile navigation.
function Home({className}:{className:string}) {return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/></svg>;}
function BookOpen({className}:{className:string}) {return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h6.5c1 0 1.5.5 1.5 1.5v12c0-1-.5-1.5-1.5-1.5H4z"/><path d="M20 5.5h-6.5C12.5 5.5 12 6 12 7v12c0-1 .5-1.5 1.5-1.5H20z"/></svg>;}
function CalendarDays({className}:{className:string}) {return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M8 3v5M16 3v5M4 10h16"/></svg>;}
function Bell({className}:{className:string}) {return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M10 19h4"/></svg>;}
function MoreHorizontal({className}:{className:string}) {return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg>;}
const cx = (...names: string[]) => names.map(name => styles[name]).join(' ');
const formatDate = (value: string | null, options: Intl.DateTimeFormatOptions) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('ja-JP', {timeZone:'Asia/Tokyo', ...options}).format(new Date(value)) : '未定';
const shortDate = (value: string | null) => formatDate(value, {month:'numeric',day:'numeric'});
const time = (value: string | null) => formatDate(value, {hour:'2-digit',minute:'2-digit'});
function Badges({item, now}: {item: Application; now: number}) {
  const status = scheduleStatus(item, now);
  return <div className={cx('status-line')}>{status && <span className={cx('badge', scheduleGroup(item, now)==='pending'?'wait':'done')}>{status}</span>}<span className={cx('badge', item.schedule?.format==='online'?'online':'face')}>{item.schedule?.format==='online'?'オンライン':'対面'}</span></div>;
}
export function LearnerSchedule({items, name, now = Date.now(), loading = false, error, onRetry, hasMore = false, onMore}: {items: Application[];name: string;now?: number;loading?: boolean;error?: string;onRetry?:()=>void;hasMore?:boolean;onMore?:()=>void}) {
  const [selectedId, setSelectedId] = useState<string|null>(null);
  // A detail can only be selected from the authenticated list; no URL-provided record is fetched.
  const selected = items.find(item => item.id===selectedId && item.schedule);
  const groups = [{key:'pending',title:'日程調整中'},{key:'upcoming',title:'これからの予定'},{key:'past',title:'終了した予定'}] as const;
  const choose = (id: string|null) => {setSelectedId(id); window.scrollTo({top:0,behavior:'smooth'});};
  const schoolNames = [...new Set(items.map(item=>item.headquarters_name))].join(' / ') || 'Academy';
  const nav = [{label:'ホーム',href:'/academy/learner-home',icon:Home},{label:'学ぶ',href:'/academy/learner-home#learner-home-learning',icon:BookOpen},{label:'予定',href:'/academy/learner-schedule',icon:CalendarDays},{label:'お知らせ',href:`/academy/learner-home#${homeStyles.notices}`,icon:Bell},{label:'その他',href:undefined,icon:MoreHorizontal}];
  return <div className={cx('root')}><div className={cx('app')}><aside className={cx('side')}><div className={cx('brand')}>mikkeOS<small>Academy｜受講者</small></div><nav className={cx('nav')}>{nav.slice(0,4).map(item=><div key={item.label} className={item.label==='予定'?cx('on'):undefined}><a href={item.href} aria-disabled={!item.href || undefined} tabIndex={!item.href ? -1 : undefined} aria-current={item.label==='予定'?'page':undefined}>{item.label}</a></div>)}<div>認定・証書（準備中）</div><div>設定（準備中）</div></nav></aside><div><header className={cx('top')}><strong>{schoolNames}</strong><span>{name}</span></header><main className={cx('wrap')}><div className={cx('titlebar')}><div className={cx('en')}>SCHEDULE</div><div className={cx('jp')}>予定</div></div><div className={cx('headbox')}><p>これからの受講予定や、日程調整中の講座を確認できます。</p></div>
    {error && <div className={cx('section')} role="alert"><p>{error}</p>{onRetry && <button className={cx('btn')} onClick={onRetry}>もう一度読み込む</button>}</div>}
    {loading && <p role="status">予定を読み込んでいます…</p>}
    {!selected ? <div className={cx('list-view')}>{groups.map(group=>{const rows=items.filter(item=>scheduleGroup(item,now)===group.key).sort((a,b)=>{const av=Date.parse(a.schedule!.starts_at??'')||0;const bv=Date.parse(b.schedule!.starts_at??'')||0;return group.key==='past'?bv-av:av-bv;});return <section key={group.key} className={cx('section',...(group.key==='past'?['past']:[]))}><div className={cx('section-head')}><h2>{group.title}</h2><small>{rows.length}件{hasMore?'（読込済み）':''}</small></div><div className={cx('list')}>{rows.map(item=><div key={item.id} className={cx('card',...(group.key==='pending'?['emphasis']:[]))}><div className={cx('schedule-row')}><div className={cx('date')}><div className={cx('md')}>{shortDate(item.schedule!.starts_at)}</div><div className={cx('time')}>{group.key==='pending'?'相談中':`${time(item.schedule!.starts_at)}–${item.schedule!.ends_at?time(item.schedule!.ends_at):'終了未確認'}`}</div></div><div className={cx('info')}><Badges item={item} now={now}/><h3 className={cx('course')}>{item.schedule!.title || item.sales_plan_name}</h3><div className={cx('summary-line')}><span>{item.schedule!.format==='online'?'オンライン':item.schedule!.venue_name||'会場未確認'}</span><span>担当講師：未確認</span></div></div><div className={cx('actions')}><button className={cx('btn',...(group.key!=='past'?['blue']:[]))} onClick={()=>choose(item.id)}>詳細</button></div></div></div>)}{!rows.length&&!loading&&!error&&<p className={cx('meta')}>{group.title}はありません。</p>}</div></section>;})}{hasMore&&<button className={cx('btn')} disabled={loading} onClick={onMore}>続きを読み込む</button>}</div> : <ScheduleDetail item={selected} now={now} onBack={()=>choose(null)}/>}
  </main></div></div><nav className={cx('mobile-bottom')}>{nav.map(item=><a key={item.label} href={item.href} aria-disabled={!item.href || undefined} tabIndex={!item.href ? -1 : undefined} aria-current={item.label==='予定'?'page':undefined} style={item.label==='予定'?{color:'var(--blue)'}:undefined}><item.icon className={cx('nav-icon')}/><small>{item.href ? item.label : `${item.label}（準備中）`}</small></a>)}</nav></div>;
}
function ScheduleDetail({item, now, onBack}: {item: Application;now:number;onBack:()=>void}) {
  const schedule=item.schedule!;const group=scheduleGroup(item,now);const cancelled=scheduleStatus(item,now)==='中止';const url=!cancelled?safeMeetingUrl(schedule.meeting_url):null;
  return <section className={cx('detail-view','on')}><button className={cx('detail-back')} onClick={onBack}>← 予定一覧へ</button><div className={cx('detail-card')}><div className={cx('detail-title')}><div><Badges item={item} now={now}/><h1>{schedule.title||item.sales_plan_name}</h1><p>担当講師：未確認</p></div></div>
    <div className={cx('primary-info')}><h2>日時</h2><p>{group==='pending'?'未定（日程調整中）':`${formatDate(schedule.starts_at,{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}–${schedule.ends_at?formatDate(schedule.ends_at,{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'終了時刻は未確認'}`}</p></div>
    <div className={cx('primary-grid')}><div className={cx('primary-info')}><h2>{schedule.format==='online'?'参加方法':group==='pending'?'受講エリア':'会場'}</h2><p>{schedule.format==='online'?(cancelled?'中止された予定です。':url?<a className={cx('detail-link')} href={url} target="_blank" rel="noopener noreferrer">参加URLを開く →</a>:'参加URLは未確認です。'):schedule.venue_name||'会場・受講エリアは未確認です。'}{schedule.format==='in_person'&&<><br/>詳しい住所は未確認です。</>}</p></div><div className={cx('primary-info')}><h2>受講方法</h2><p>{schedule.format==='online'?'オンライン':'対面'}</p></div></div>
    <div className={cx('primary-info')} style={{marginTop:9}}><h2>持ち物・事前準備</h2><p>持ち物・事前準備の案内は未確認です。</p></div><div className={cx('primary-info')}><h2>キット・発送</h2><p>キットの有無・受取方法・発送状況は未確認です。</p></div>
    <div className={cx('detail-block')}><h2>この講座について</h2><ul className={cx('course-facts')}><li>販売プラン：{item.sales_plan_name}</li><li>受講料：{new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY'}).format(item.tuition.amount)}</li><li>受講後：{item.completed_at?'修了済み。証書・ライセンスの条件は未確認です。':'認定・証書・ライセンスの条件は未確認です。'}</li></ul><p>講座紹介ページ：未確認</p></div>
    <div className={cx('detail-block')}><h2>レッスン教材</h2><div className={cx('learn-panel')}><strong>{item.materials_available?'レッスン教材を利用できます':'教材の利用状態は未確認です'}</strong><p>{item.materials_available?'公開されている教材を確認できます。':'公開時期・閲覧条件は未確認です。'}</p>{item.materials_available?<div className={cx('learn-actions')}><a className={cx('btn','blue')} href={`/academy/portal/study?view=learner&application=${encodeURIComponent(item.id)}`}>{item.completed_at?'この講座を復習する':'この講座を学ぶ'}</a></div>:<div className={cx('locked-note')}>現在、この画面から教材を開けません。</div>}</div></div><div className={cx('detail-block')}><h2>当日の案内</h2><p>{cancelled?'この予定は中止されています。':'当日の案内は未確認です。'}</p></div>
  </div></section>;
}
function Connected() {
  const {user,profile}=useAuth();const [items,setItems]=useState<Application[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [hasMore,setHasMore]=useState(false);const [retry,setRetry]=useState(0);const [page,setPage]=useState(0);const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{let live=true;setLoading(true);setError('');void listMyAcademy2Applications({limit:100,offset:page*100}).then(rows=>{if(live){setItems(old=>page===0?rows:[...old,...rows.filter(row=>!old.some(item=>item.id===row.id))]);setHasMore(rows.length===100);}}).catch(()=>{if(live)setError('予定を読み込めませんでした。もう一度お試しください。');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[user.id,page,retry]);
  return <LearnerSchedule items={items} name={profile.display_name} now={now} loading={loading} error={error} hasMore={hasMore} onRetry={()=>setRetry(value=>value+1)} onMore={()=>{if(!loading&&!error)setPage(value=>value+1);}}/>;
}
function Identity(){const {user}=useAuth();return <Connected key={user.id}/>;}
export function ConnectedLearnerSchedule(){return <AuthGate><Identity/></AuthGate>;}


