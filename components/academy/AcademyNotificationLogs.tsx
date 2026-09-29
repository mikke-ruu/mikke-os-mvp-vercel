"use client";

import { useEffect, useRef, useState } from 'react';
import { renderSnapshotPlainBody } from '@/lib/academy/offering-mail-content.mjs';
import { listNotificationLogs, type NotificationLog, type NotificationLogPage } from '@/lib/academy/notification-logs';

const labels = { receipt: '申込受付', headquarters: '本部への申込通知', materials: '入金確認後の案内', instructor_registered: '講師登録完了', instructor_invitation: 'mikke ID登録・本人連携の案内', instructor_linked: '講師の本人連携完了', instructor_order_headquarters: '旧申込の講座用教材注文（本部へ）', instructor_order_received: '旧申込の講座用教材注文（講師へ）' };
const date = (value: string | null) => value ? new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '—';
const reasons: Record<string, string> = {
  verified_recipient_missing: '確認済みの送信先がありません。', delivery_failed: '送信処理に失敗しました。',
  retry_window_expired: '再試行できる時間を過ぎたため、確認が必要です。',
  retry_limit_reached: '再試行の上限に達したため、確認が必要です。', unknown_error: '処理結果の確認が必要です。',
  invitation_not_current: 'この招待は期限切れ、変更、または連携完了により無効になりました。',
};
function status(row: NotificationLog) {
  if (row.status === 'sent') return '送信サービス受付済み';
  if (row.status === 'review') return '要確認';
  if (row.status === 'cancelled') return '案内停止（リンク無効）';
  if (row.status === 'sending') return row.lease_until && Date.parse(row.lease_until) < Date.now() ? '処理結果の確認待ち' : '処理中';
  return row.attempts > 0 ? '失敗・再試行待ち' : '送信待ち';
}
function Snapshot({ row }: { row: NotificationLog }) {
  let body: string;
  try { body = renderSnapshotPlainBody(row.kind, row.payload); }
  catch { return <p className="text-sm">この本文の表示形式を確認できませんでした。</p>; }
  return <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-[var(--mikke-surface-soft)] p-3 font-sans text-sm leading-7 [overflow-wrap:anywhere]">{body}</pre>;
}

export function AcademyNotificationLogs({ headquartersId, sampleOnly = false }: { headquartersId: string; sampleOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<NotificationLogPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => { generation.current++; setPage(null); setError(''); setBusy(false); return () => { generation.current++; }; }, [headquartersId]);
  async function load(more = false) {
    if (busy || sampleOnly) return;
    const request = generation.current;
    setBusy(true); setError('');
    try {
      const result = await listNotificationLogs(headquartersId, more ? page?.next_cursor ?? null : null);
      if (request !== generation.current) return;
      setPage(current => ({ items: more && current ? [...current.items, ...result.items.filter(row => !current.items.some(old => old.id === row.id && old.source_type === row.source_type))] : result.items, next_cursor: result.next_cursor }));
    } catch (reason) { if (request === generation.current) setError(reason instanceof Error ? reason.message : 'メールログを読み込めませんでした。'); }
    finally { if (request === generation.current) setBusy(false); }
  }
  return <section className="min-w-0 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5" aria-label="通知メールのログ">
    <button type="button" className="flex w-full items-center justify-between gap-3 text-left font-bold" aria-expanded={open} onClick={() => { setOpen(value => !value); if (!open && !page) void load(); }}>通知メールのログ<span aria-hidden="true">{open ? '−' : '＋'}</span></button>
    {open ? <>
      <p className="mt-3 text-xs leading-6 text-[var(--mikke-muted)]">「送信サービス受付済み」は送信サービスが受け付けた状態です。受信箱への到着や開封を示すものではありません。時刻は日本時間です。</p>
      {sampleOnly ? <p className="mt-3 text-sm">操作確認用のため、実際のメールログは取得しません。</p> : <button type="button" disabled={busy} onClick={() => void load()} className="my-3 rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm disabled:opacity-50">更新する</button>}
      {error ? <p role="alert" className="my-3 text-sm text-red-700">{error}</p> : null}
      {!busy && page?.items.length === 0 ? <p className="text-sm">通知の記録はまだありません。</p> : null}
      <ul className="space-y-3">{page?.items.map(row => <li key={`${row.source_type}:${row.id}`} className="min-w-0 rounded-xl border border-[var(--mikke-line)] p-3">
        <div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-bold">{labels[row.kind]}</h3><span className="text-xs font-bold">{status(row)}</span></div>
        <p className="mt-2 break-words text-sm [overflow-wrap:anywhere]">宛先：{row.recipient_masked || '確認済みの宛先なし'}</p>
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs leading-6"><dt>受付</dt><dd>{date(row.created_at)}</dd><dt>初回の送信処理</dt><dd>{date(row.first_attempt_at)}</dd><dt>送信サービス受付</dt><dd>{date(row.sent_at)}</dd><dt>試行回数</dt><dd>{row.attempts}回</dd></dl>
        {row.last_error ? <p className="mt-2 text-xs">{reasons[row.last_error] ?? reasons.unknown_error}</p> : null}
        {row.status === 'cancelled' ? <p className="mt-1 text-xs text-[var(--mikke-muted)]">すでに送信処理が進んでいた場合、メール自体は取り消せません。古い確認リンクは利用できません。</p> : null}
        <p className="mt-2 break-all text-xs text-[var(--mikke-muted)]">{row.application_id ? '申込番号' : row.source_type === 'kit_order' ? '注文番号' : '登録・連携の記録番号'}：{row.application_id ?? row.source_id}</p>
        <details className="mt-3"><summary className="cursor-pointer text-sm">当時の本文を見る</summary><p className="mt-2 text-xs text-[var(--mikke-muted)]">{row.payload.mail_content_version == null ? '本文設定追加前の標準文' : `本文設定の版：${row.payload.template_version ?? 0}`}</p><Snapshot row={row} /></details>
      </li>)}</ul>
      {busy ? <p role="status" className="mt-3 text-sm">ログを読み込んでいます…</p> : null}
      {page?.next_cursor ? <button type="button" disabled={busy} onClick={() => void load(true)} className="mt-3 rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm disabled:opacity-50">続きを見る</button> : null}
    </> : null}
  </section>;
}
