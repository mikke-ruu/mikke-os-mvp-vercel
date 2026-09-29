"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toAcademyContextHref } from '@/lib/academy/access-context';
import { listAcademy2Events, type Academy2EventSummary } from '@/lib/academy2/operations';
import styles from './event-list.module.css';

const filters = ['すべて', '日程相談中', '講師回答待ち', '開催確定', '本日', '終了'] as const;
const timestamp = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const day = (value: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date(value));
function statusOf(event: Academy2EventSummary) {
  if (event.status === 'cancelled') return 'キャンセル';
  if (event.status === 'completed') return '終了';
  if (!event.starts_at) return '日程相談中';
  if (timestamp(event.starts_at) === null) return '日時を確認';
  if (event.instructor_response_status === 'requested') return '講師回答待ち';
  if (day(event.starts_at) === day(new Date().toISOString())) return '本日';
  return '開催確定';
}
function dateLabel(value: string | null) {
  return value ? timestamp(value) === null ? '日時を確認' : new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }).format(new Date(value)) : '日時未確定';
}

/** List geometry and typography follow the approved UI-09 v0.8, not its sample data. */
export function Academy2EventList({ headquartersId }: { headquartersId: string }) {
  const [events, setEvents] = useState<Academy2EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<typeof filters[number]>('すべて');
  const [sort, setSort] = useState('upcoming');
  useEffect(() => {
    let current = true;
    setEvents([]); setLoading(true); setError('');
    listAcademy2Events(headquartersId).then(rows => { if (current) setEvents(rows); })
      .catch(cause => { if (current) setError(cause instanceof Error ? cause.message : '開催を読み込めませんでした。'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [headquartersId, retry]);
  const visible = useMemo(() => events.filter(event => {
    const search = [event.title, event.sales_plan_name, event.course_name, event.instructor_name, ...(event.applicant_names ?? [])].join(' ').toLocaleLowerCase('ja-JP');
    return search.includes(query.trim().toLocaleLowerCase('ja-JP')) && (filter === 'すべて' || statusOf(event) === filter);
  }).sort((a, b) => {
    const aTime = timestamp(a.starts_at), bTime = timestamp(b.starts_at);
    if (aTime === null && bTime === null) return a.id.localeCompare(b.id);
    if (aTime === null) return -1;
    if (bTime === null) return 1;
    return (sort === 'upcoming' ? 1 : -1) * (aTime - bTime);
  }), [events, query, filter, sort]);
  const href = (value: string) => toAcademyContextHref(value, headquartersId, 'manage');
  return <section className={styles.wrap}>
    <div className={styles.heroTitle}><div className={styles.en}>EVENTS</div><h1 className={styles.jp}>開催</h1></div>
    <div className={styles.heroBody}><p>日時指定・日程相談・講師依頼・開催確定まで、実際の開催をここで管理します。</p><Link className={styles.primary} href={href('/academy/classes/new')}>＋ 開催を追加</Link></div>
    <nav aria-label="運営の流れ" className={styles.guide}><Link href={href('/academy/offerings')}>販売プラン</Link><span>→</span><Link href={href('/academy/classes')} aria-current="page">開催</Link><span>→</span><Link href={href('/academy/offering-applications')}>申込</Link><span>→</span><span>受講・修了</span></nav>
    <div className={styles.toolbar}><input aria-label="販売プラン・受講者・講師で検索" className={styles.search} placeholder="販売プラン・受講者・講師で検索" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="並び替え" className={styles.sort} value={sort} onChange={e => setSort(e.target.value)}><option value="upcoming">開催日が近い順</option><option value="recent">開催日が新しい順</option></select></div>
    <div className={styles.filters} aria-label="開催の絞り込み">{filters.map(value => <button key={value} type="button" className={`${styles.filter} ${filter === value ? styles.on : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}</div>
    {loading ? <p role="status" className={styles.message}>開催を読み込み中…</p> : error ? <div role="alert" className={styles.message}><p>{error}</p><button type="button" className={styles.sort} onClick={() => setRetry(value => value + 1)}>再読み込み</button></div> : !visible.length ? <p role="status" className={styles.message}>{events.length ? '条件に合う開催はありません。' : '開催はまだありません。'}</p> : <ul className={styles.eventList}>{visible.map(event => {
      const status = statusOf(event);
      return <li key={event.id} className={styles.eventCard}>
        <div className={styles.eventIcon}>{event.main_image_url ? <img src={event.main_image_url} alt="" /> : '開催'}</div>
        <div className={styles.eventMain}><strong>{event.title}</strong><div className={styles.meta}>
          <span>{dateLabel(event.starts_at)}</span><span>{event.format === 'online' ? 'オンライン' : '対面'}</span><span>{event.application_count}{event.capacity == null ? '' : ` / ${event.capacity}`}名</span><span>担当 {event.instructor_name || '未確定'}</span>
          <span className={`${styles.status} ${status === '日程相談中' ? styles.yellow : status === '講師回答待ち' ? styles.blue : status === '本日' ? styles.orange : status === '開催確定' ? styles.green : styles.gray}`}>{status}</span>
        </div></div><Link className={styles.pending} href={href(`/academy/classes/${event.id}`)} aria-label={`${event.title}の詳細`}>詳細 →</Link>
      </li>;
    })}</ul>}
  </section>;
}
