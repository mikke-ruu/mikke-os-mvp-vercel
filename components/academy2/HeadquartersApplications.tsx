'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {applicationScheduleLabel} from '@/lib/academy2/application-schedule';
import styles from './applications-operation.module.css';
import { useAcademy2Headquarters } from './HeadquartersBoundary';
import { toAcademyContextHref } from '@/lib/academy/access-context';
import { listHeadquartersApplications, type HeadquartersApplicationSummary } from '@/lib/academy2/headquarters-applications';

export function applicationDate(value: string | null | undefined) {
  if (!value) return '未設定';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '未設定' : new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}
export const nextActionLabel = (key: string | null) => ({ confirm_payment: '支払い確認', confirm_tuition: '支払い確認', confirm_schedule: '日程調整', set_shipping_destination: '発送先確認', record_shipping: 'キット発送', event_kit_shipping: '開催のキット発送', ship_kit: 'キット発送', confirm_completion: '受講終了を確認する', submit_completion: '修了報告', confirm_certification: '認定', review_outcome: '認定確認', pay_opening_license: '開講ライセンス支払い', done: '対応完了', wait: '確認待ち' }[key ?? ''] ?? '申込詳細を確認');
export const applicationCompleted = (row: HeadquartersApplicationSummary) => row.completed === true || !!row.completedAt;

export function applicationPaymentLabel(value: string | null | undefined) {
  return ({ paid: '入金済み', unpaid: '未払い', pending: '入金確認待ち', confirmed: '入金確認済み', refunded: '返金済み', not_required: '支払い不要' } as Record<string, string>)[value ?? ''] ?? '確認中';
}

/** Existing application-list layout; Academy2 RPC is the authority for scope and redaction. */
export function HeadquartersApplications({ mode = 'applications' }: { mode?: 'applications' | 'attention' | 'certifications' }) {
  const hq = useAcademy2Headquarters();
  const query = useSearchParams();
  const [rows, setRows] = useState<HeadquartersApplicationSummary[] | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState((query.get('q')??'').slice(0,200));
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [sort, setSort] = useState(query.get('sort')==='oldest'?'oldest':'recent');
  const [saleChannel, setSaleChannel] = useState(['headquarters','instructor'].includes(query.get('channel')??'')?query.get('channel')!:'all');
  const [filter, setFilter] = useState(mode === 'attention' ? 'attention' : ['all','attention','schedule','shipping','payment_pending','completion_pending','completed'].includes(query.get('filter')??'') ? query.get('filter')! : query.get('action') === 'payment' ? 'payment_pending' : query.get('action') === 'schedule' ? 'schedule' : query.get('action') === 'shipping' ? 'shipping' : query.get('tab') === 'koushi' ? 'shipping' : 'all');
  useEffect(() => {
    if (!hq) return;
    let current = true; setError(''); setRows(null);
    listHeadquartersApplications(hq.id).then(result => { if (current) setRows(result); }).catch(cause => { if (current) setError(cause instanceof Error ? cause.message : '申込を読み込めませんでした。'); });
    return () => { current = false; };
  }, [hq?.id, retry]);
  if (!hq) return null;
  const title = mode === 'attention' ? 'ホーム' : mode === 'certifications' ? '認定' : '申込';
  const tabs = mode === 'certifications' ? [['all', 'すべて'], ['certification_pending', '認定待ち'], ['certified', '認定済み'], ['completion_pending', '修了確認待ち'], ['attention', '要対応']]
    : mode === 'attention' ? [['attention', '要対応'], ['all', 'すべて']]
    : [['all', 'すべて'], ['attention', '要対応'], ['schedule', '日程調整待ち'], ['shipping', '発送待ち'], ['payment_pending', '入金確認待ち'], ['completion_pending', '修了確認待ち'], ['completed', '完了済み']];
  const shown = rows?.filter(row => {
    if (mode === 'applications' && saleChannel !== 'all' && row.saleChannel !== saleChannel) return false;
    if (filter === 'schedule' && !(row.schedule?.individual&&!row.schedule.startsAt) && row.nextAction !== 'confirm_schedule') return false;
    if (![row.applicantName, row.planTitle].join(' ').toLocaleLowerCase('ja-JP').includes(search.trim().toLocaleLowerCase('ja-JP'))) return false;
    if (filter === 'payment_pending') return ['confirm_payment', 'confirm_tuition'].includes(row.nextAction ?? '');
    if (filter === 'completed') return row.nextAction==='done'||applicationCompleted(row)&&!row.nextAction;
    if (filter === 'all' || filter === 'schedule') return true;
    if (filter === 'certified') return !!row.certifiedAt;
    if (filter === 'certification_pending') return !row.certifiedAt && ['confirm_certification', 'review_outcome'].includes(row.nextAction ?? '');
    if (filter === 'completion_pending') return !row.completedAt && ['confirm_completion', 'submit_completion'].includes(row.nextAction ?? '');
    if (filter === 'attention') return !!row.nextAction && !['done', 'wait'].includes(row.nextAction);
    if (filter === 'shipping') return row.kitStatus && !['shipped', 'not_required'].includes(row.kitStatus);
    return row.saleChannel === filter;
  }).sort((a, b) => {
    const aTime = Date.parse(a.appliedAt), bTime = Date.parse(b.appliedAt);
    const difference = (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
    return (sort === 'recent' ? -difference : difference) || a.applicationId.localeCompare(b.applicationId);
  });
  const detailHref=(id:string)=>{const p=new URLSearchParams({listFilter:filter,listChannel:saleChannel,listSort:sort});if(search)p.set('listSearch',search);if(mode==='certifications')p.set('from','certifications');return toAcademyContextHref('/academy/applications/'+id+'?'+p.toString(),hq.id,'manage');};
  return <div className={styles.wrap}>
    <div className={styles.heroTitle}><div className={styles.en}>{mode === 'applications' ? 'APPLICATIONS' : 'MY ACADEMY'}</div><h1 className={styles.jp}>{title}</h1></div>
    <div className={styles.heroBody}><p>申込内容と対応状況を確認します。</p><div className={styles.listTools}><button type="button" className={styles.iconButton} aria-label="申込情報を更新" onClick={()=>setRetry(v=>v+1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/></svg></button></div></div>
    <div className={styles.toolbar}><input className={styles.input} aria-label="申込者・販売プランで検索" placeholder="申込者・販売プランで検索" value={search} onChange={e=>setSearch(e.target.value)}/><select className={styles.input} aria-label="並び替え" value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">申込日が新しい順</option><option value="oldest">申込日が古い順</option></select></div>
    <button className={styles.mobileFilters} type="button" aria-expanded={filtersOpen} aria-controls={'application-filters-'+mode} onClick={()=>setFiltersOpen(v=>!v)}>絞り込み{saleChannel!=='all'||filter!=='all'?'（選択中）':''} <span aria-hidden="true">{filtersOpen?'−':'＋'}</span></button>
    <div id={'application-filters-'+mode} className={styles.filterPanels+' '+(filtersOpen?styles.filtersOpen:'')}>
    {mode==='applications'&&<div className={styles.filterGroup}><span className={styles.filterLabel}>販売元</span><nav aria-label="販売元の絞り込み" className={styles.filters}>{[['all','すべて'],['headquarters','本部販売'],['instructor','講師販売']].map(([value,label])=><button key={value} type="button" aria-pressed={saleChannel===value} onClick={()=>setSaleChannel(value)} className={styles.filter}>{label}</button>)}</nav></div>}
    <div className={styles.filterGroup}><span className={styles.filterLabel}>対応状態</span><nav aria-label={title+'の絞り込み'} className={styles.filters}>{tabs.map(([value,label])=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)} className={styles.filter}>{label}</button>)}</nav></div></div>
    {error&&<div role="alert" className={styles.error}><p>申込情報を読み込めませんでした。</p><p>{error}</p></div>}
    {!rows&&!error&&<p role="status">読み込み中…</p>}
    {shown?.length===0&&<p className={styles.empty}>該当する申込はありません。</p>}
    <div className={styles.list}>{shown?.map(row=>{const payment=row.tuition?applicationPaymentLabel(row.tuition.status):null;return <a key={row.applicationId} className={styles.linkCard} href={detailHref(row.applicationId)}>
      <div className={styles.cardTitle}><h2>{row.applicantName}</h2></div>
      <p className={styles.planLine}>{row.planTitle}</p>
      <p className={styles.scheduleLine}>{applicationScheduleLabel(row.schedule)}</p>
      <div className={styles.applicantLine}>{row.tuition&&<span className={styles.cardPrice}>受講料 {new Intl.NumberFormat('ja-JP',{style:'currency',currency:row.tuition.currency||'JPY'}).format(row.tuition.amount)}</span>}</div>
      <div className={styles.responseLine}>{payment&&<span className={styles.stateBadge}>{payment}</span>}{<span className={styles.nextLine}>{row.nextAction==='done'||!row.nextAction&&applicationCompleted(row)?'対応完了':row.source?.startsWith('legacy_')&&!row.nextAction?'過去の申込記録':row.nextAction==='wait'?'確認待ち':row.nextAction==='confirm_completion'?nextActionLabel(row.nextAction):'次の対応：'+nextActionLabel(row.nextAction)}</span>}</div>
      <div className={styles.cardMeta}><span>申込 {applicationDate(row.appliedAt)}</span><span>{row.saleChannel==='instructor'?'講師販売':'本部販売'}</span></div>
      {mode==='certifications'&&<p>修了：{row.completedAt?applicationDate(row.completedAt):'未完了'} ／ 認定：{row.certifiedAt?applicationDate(row.certifiedAt):'未確定'}</p>}
    </a>;})}</div>
  </div>;
}
