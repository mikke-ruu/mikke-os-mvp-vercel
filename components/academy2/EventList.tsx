"use client";

import { AcademyManagementActions } from './AcademyManagementActions';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toAcademyContextHref } from '@/lib/academy/access-context';
import { listAcademy2Events, type Academy2EventSummary } from '@/lib/academy2/operations';
import { listSalesPlanCatalog } from '@/lib/academy2/sales-plan-catalog';
import { listAcademy2Courses } from '@/lib/academy2/courses';
import styles from './event-list.module.css';

const filters = ['すべて', '中止', '日程相談中', '講師回答待ち', '開催確定', '本日', '終了'] as const;
const timestamp = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const day = (value: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date(value));
function statusOf(event: Academy2EventSummary) {
  if (event.status === 'cancelled') return '中止';
  if (event.status === 'completed') return '終了';
  if (!event.starts_at) return '日程相談中';
  if (timestamp(event.starts_at) === null) return '日時を確認';
  if (event.instructor_response_status === 'requested') return '講師回答待ち';
  if (day(event.starts_at) === day(new Date().toISOString())) return '本日';
  return '開催確定';
}
function dateLabel(value: string | null) {
  return value ? timestamp(value) === null ? '日時を確認' : new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }).format(new Date(value)) : '申込後に日程相談';
}

/** List geometry and typography follow the approved UI-09 v0.8, not its sample data. */
export function Academy2EventList({ headquartersId }: { headquartersId: string }) {
  const [showArchived, setShowArchived] = useState(false);
  const [events, setEvents] = useState<Academy2EventSummary[]>([]);
  const [planImages, setPlanImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<typeof filters[number]>('すべて');
  const [sort, setSort] = useState('upcoming');
  useEffect(() => {
    let current = true;
    setEvents([]); setPlanImages({}); setLoading(true); setError('');
    // Read images in two batches; image availability does not gate the event list.
    void Promise.allSettled([listSalesPlanCatalog(headquartersId), listAcademy2Courses(headquartersId)]).then(([plans, courses]) => {
      if (!current || plans.status !== 'fulfilled' || courses.status !== 'fulfilled') return;
      const images = new Map(courses.value.map(course => [course.id, course.main_image_url]));
      const next: Record<string, string> = {};
      for (const plan of plans.value) {
        const image = plan.configuration.course_ids.map(id => images.get(id)).find(value => !!value);
        if (image) next[plan.id] = image;
      }
      setPlanImages(next);
    });
    listAcademy2Events(headquartersId).then(rows => { if (current) setEvents(rows); })
      .catch(cause => { if (current) setError(`開催情報を読み込めませんでした。${cause instanceof Error ? ` ${cause.message}` : ''}`); })
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
    <div className={styles.heroBody}><p>開催日程や担当者、募集状況を管理します。</p><Link className={styles.primary} href={href('/academy/create?tab=event')}>＋ 開催を追加</Link></div>

    <div className={styles.toolbar}><input aria-label="販売プラン・受講者・講師で検索" className={styles.search} placeholder="販売プラン・受講者・講師で検索" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="並び替え" className={styles.sort} value={sort} onChange={e => setSort(e.target.value)}><option value="upcoming">開催日が近い順</option><option value="recent">開催日が新しい順</option></select></div>
    <div className={styles.filters} aria-label="開催の絞り込み">{filters.map(value => <button key={value} type="button" className={`${styles.filter} ${filter === value ? styles.on : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}</div>
    <label><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> アーカイブ済みを表示</label>
    {loading ? <p role="status" className={styles.message}>開催を読み込み中…</p> : error ? <div role="alert" className={styles.message}><p>{error}</p><button type="button" className={styles.sort} onClick={() => setRetry(value => value + 1)}>再読み込み</button></div> : !visible.length ? <p role="status" className={styles.message}>{events.length ? '条件に合う開催はありません。' : '開催はまだありません。'}</p> : <ul className={styles.eventList}>{visible.map(event => {
      const status = statusOf(event);
      const image = (event.sales_plan_id && planImages[event.sales_plan_id]) || event.main_image_url;
      return <li key={event.id}><AcademyManagementActions compact hideState headquartersId={headquartersId} kind="event" id={event.id} title={event.title} showArchived={showArchived} onChanged={()=>setRetry(n=>n+1)}><Link className={styles.eventCard} href={href(`/academy/classes/${event.id}`)} aria-label={`${event.title}の詳細`}>
        <div className={styles.eventIcon}>{image ? <img src={image} alt="" /> : <span className={styles.imageFallback} aria-hidden="true">▧</span>}</div>
        <div className={styles.eventMain}><strong>{event.title}</strong><div className={styles.meta}>
          <span>{dateLabel(event.starts_at)}</span><span>{event.format === 'online' ? 'オンライン' : '対面'}</span><span>{event.application_count}{event.capacity == null ? '' : ` / ${event.capacity}`}名</span>{event.instructor_name&&<span>担当 {event.instructor_name}</span>}
          <span className={`${styles.status} ${status === '日程相談中' ? styles.yellow : status === '講師回答待ち' ? styles.blue : status === '本日' ? styles.orange : status === '開催確定' ? styles.green : styles.gray}`}>{status}</span>
        <span className={styles.registration}>受付：{event.registration_status==='draft'?'下書き':event.registration_status==='open'?'受付中':'受付停止'}</span></div></div>
      </Link></AcademyManagementActions></li>;
    })}</ul>}
  </section>;
}
