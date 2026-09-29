'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAcademy2Headquarters } from './HeadquartersBoundary';
import { toAcademyContextHref } from '@/lib/academy/access-context';
import { listHeadquartersApplications, type HeadquartersApplicationSummary } from '@/lib/academy2/headquarters-applications';

export function applicationDate(value: string | null | undefined) {
  if (!value) return '未設定';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '未設定' : new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}
export const nextActionLabel = (key: string | null) => ({ confirm_payment: '支払い確認', confirm_tuition: '支払い確認', confirm_schedule: '日程確定', set_shipping_destination: '発送先確認', record_shipping: 'キット発送', event_kit_shipping: '開催のキット発送', ship_kit: 'キット発送', confirm_completion: '修了確認', submit_completion: '修了報告', confirm_certification: '認定', review_outcome: '認定確認', pay_opening_license: '開講ライセンス支払い', done: '対応完了', wait: '確認待ち' }[key ?? ''] ?? '申込詳細を確認');

/** Existing application-list layout; Academy2 RPC is the authority for scope and redaction. */
export function HeadquartersApplications({ mode = 'applications' }: { mode?: 'applications' | 'attention' | 'certifications' }) {
  const hq = useAcademy2Headquarters();
  const query = useSearchParams();
  const [rows, setRows] = useState<HeadquartersApplicationSummary[] | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState(mode === 'attention' ? 'attention' : query.get('tab') === 'koushi' ? 'shipping' : 'all');
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
    : [['all', 'すべて'], ['headquarters', '本部販売'], ['instructor', '講師販売'], ['shipping', '発送待ち']];
  const shown = rows?.filter(row => {
    if (filter === 'all') return true;
    if (filter === 'certified') return !!row.certifiedAt;
    if (filter === 'certification_pending') return !row.certifiedAt && ['confirm_certification', 'review_outcome'].includes(row.nextAction ?? '');
    if (filter === 'completion_pending') return !row.completedAt && ['confirm_completion', 'submit_completion'].includes(row.nextAction ?? '');
    if (filter === 'attention') return !row.certifiedAt && !!row.nextAction && !['done', 'wait'].includes(row.nextAction);
    if (filter === 'shipping') return row.kitStatus && !['shipped', 'not_required'].includes(row.kitStatus);
    return row.saleChannel === filter;
  });
  return <div className="mx-auto max-w-3xl space-y-4">
    <header className="flex items-center justify-between gap-3"><div><p className="text-xs text-[var(--mikke-text-soft)]">MY ACADEMY</p><h1 className="text-xl font-bold">{title}</h1></div><button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setRetry(value => value + 1)}>再読み込み</button></header>
    <nav aria-label={`${title}の絞り込み`} className="flex flex-wrap gap-2 border-y border-[var(--mikke-line)] py-3">{tabs.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className="min-h-11 border border-[var(--mikke-line)] px-3 text-sm aria-pressed:font-bold aria-pressed:text-[var(--mikke-primary)]">{label}</button>)}</nav>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!rows && !error && <p role="status">読み込み中…</p>}
    {shown?.length === 0 && <p className="py-5 text-sm">該当する申込はありません。</p>}
    {shown?.map(row => <section key={row.applicationId} className="space-y-2 border-t border-[var(--mikke-line)] py-5 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold break-words">{row.planTitle}</h2><span>{row.statusLabel}</span></div>
      <p className="text-xs text-[var(--mikke-text-soft)]">{applicationDate(row.appliedAt)} ・ {row.saleChannel === 'instructor' ? '講師販売' : '本部販売'}</p>
      <p className="break-words font-bold">{row.applicantName}</p>
      {row.tuition && <p>受講料 {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: row.tuition.currency || 'JPY' }).format(row.tuition.amount)}</p>}
      {mode === 'certifications' && <p>修了：{row.completedAt ? applicationDate(row.completedAt) : '未完了'} ／ 認定：{row.certifiedAt ? applicationDate(row.certifiedAt) : '未確定'}</p>}
      <p>次の対応：{nextActionLabel(row.nextAction)}</p>
      <a className="inline-flex rounded-xl border border-[var(--mikke-line)] px-4 py-2 font-bold" href={toAcademyContextHref(`/academy/applications/${row.applicationId}${mode === 'certifications' ? '?from=certifications' : ''}`, hq.id, 'manage')}>申込詳細を見る</a>
    </section>)}
  </div>;
}
