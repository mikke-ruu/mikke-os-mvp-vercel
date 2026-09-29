'use client';

import { useEffect, useRef, useState } from 'react';
import { useAcademy2Headquarters } from './HeadquartersBoundary';
import { toAcademyContextHref } from '@/lib/academy/access-context';
import { commandHeadquartersApplication, getHeadquartersApplication, type HeadquartersApplicationDetail as Detail, type HeadquartersApplicationAction } from '@/lib/academy2/headquarters-applications';
import { getAcademy2Event, updateAcademy2Event } from '@/lib/academy2/operations';
import {ApplicationAnswerSummary} from './ApplicationAnswerSummary';
import { applicationDate, nextActionLabel } from './HeadquartersApplications';

const card = 'space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4';
const inputClass = 'min-w-0 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-base text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)] sm:text-sm';
const button = 'rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm font-bold disabled:opacity-50';
function Row({ label, children }: { label: string; children: React.ReactNode }) { return <div className="flex justify-between gap-3 py-1 text-sm"><span className="shrink-0 text-[var(--mikke-text-soft)]">{label}</span><span className="min-w-0 break-words text-right [overflow-wrap:anywhere]">{children}</span></div>; }
function localInput(iso: string | null | undefined) { if (!iso) return ''; const date = new Date(iso); return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 16); }
function status(value: string | undefined | null) { return ({ pending: '確認待ち', paid: '支払済み', unpaid: '未払い', shipped: '発送済み', not_required: '不要', submitted: '報告済み', certified: '認定済み', attended: '出席', confirmed: '確認済み', waiting: '確認待ち', unreported: '未報告', not_started: '未実施', not_certified: '未認定', preparing: '準備中', waiting_assignment: '担当講師の確定待ち', awaiting_destination: '講師の発送先指定待ち', blocked: '開催の設定を確認' }[value ?? ''] ?? '確認中'); }

/** Provisional wiring of the existing HQ detail cards; this is not a replacement design for missing UI11. */
export function HeadquartersApplicationDetail({ applicationId }: { applicationId: string }) {
  const hq = useAcademy2Headquarters();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState('');
  const [note, setNote] = useState(''); const [address, setAddress] = useState(''); const [tracking, setTracking] = useState(''); const [shipped, setShipped] = useState('');
  const [starts, setStarts] = useState(''); const [ends, setEnds] = useState(''); const [dirty, setDirty] = useState(false);
  const [retry, setRetry] = useState(0);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const initialized = useRef('');
  useEffect(() => { if (!hq) return; let live = true; setError('');
    getHeadquartersApplication(hq.id, applicationId).then(result => { if (!live) return; setData(result);
      if (initialized.current !== applicationId) { initialized.current = applicationId; setAddress(result.headquarters?.shipping.address ?? ''); setStarts(localInput(result.headquarters?.event?.startsAt)); setEnds(localInput(result.headquarters?.event?.endsAt)); }
    }).catch(cause => { if (live) setError(cause instanceof Error ? cause.message : '申込を読み込めませんでした。'); });
    return () => { live = false; };
  }, [hq?.id, applicationId, retry]);
  function edit(set: (value: string) => void, value: string) { set(value); setDirty(true); setSaved(''); }
  async function execute(action: HeadquartersApplicationAction, input: Record<string, unknown> = {}) {
    if (!hq || !data || busy) return;
    setBusy(true); setError(''); setSaved('');
    const signature = JSON.stringify([applicationId, data.summary.revision, action, input]);
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    try { const result = await commandHeadquartersApplication(hq.id, applicationId, data.summary.revision, request.current.id, action, input); setData(result); request.current = null; setSaved('保存しました。'); setDirty(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存できませんでした。入力内容は残っています。'); }
    finally { setBusy(false); }
  }
  async function saveSchedule() {
    if (!hq || !data?.headquarters?.event || busy) return;
    if (!starts || !ends || ends <= starts) { setError('開催の開始日時と終了日時を確認してください。'); return; }
    setBusy(true); setError(''); setSaved('');
    try {
      const event = data.headquarters.event; const original = await getAcademy2Event(hq.id, event.id);
      const signature = JSON.stringify([event.id, event.revision, starts, ends]);
      if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
      await updateAcademy2Event(hq.id, event.id, event.revision, request.current.id, { title: original.title, scheduleMode: original.schedule_mode, startsAt: new Date(`${starts}:00+09:00`).toISOString(), endsAt: new Date(`${ends}:00+09:00`).toISOString(), format: original.format, capacity: original.capacity, venueName: event.venueName ?? undefined, meetingUrl: event.meetingUrl ?? undefined });
      setData(await getHeadquartersApplication(hq.id, applicationId)); request.current = null; setSaved('日程を保存しました。'); setDirty(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '日程を保存できませんでした。入力内容は残っています。'); } finally { setBusy(false); }
  }
  if (!hq) return null;
  if (!data) return <div className="space-y-3"><p role={error ? 'alert' : 'status'}>{error || '読み込み中…'}</p>{error && <button className={button} onClick={() => setRetry(value => value + 1)}>再読み込み</button>}</div>;
  const { summary, headquarters, instructor } = data;
  const view = instructor?.view;
  const allowed = headquarters?.allowedActions ?? instructor?.allowedActions ?? [];
  const shipping = headquarters?.shipping ?? { required: view?.kit.required, status: view?.kit.status, address: instructor?.details.shippingAddress ?? instructor?.details.kitDestination?.selectedAddress, shippedAt: instructor?.details.shippedAt, trackingNumber: instructor?.details.trackingNumber };
  const eventKit = headquarters?.shipping.recipient === 'instructor';
  const shippingEventId = headquarters?.shipping.eventId ?? headquarters?.event?.id;
  const eventLink = shippingEventId ? <a className="underline" href={toAcademyContextHref(`/academy/classes/${shippingEventId}`, hq.id, 'manage')} onClick={event => { if (busy || (dirty && !window.confirm('未保存の入力があります。開催詳細へ移動しますか？'))) event.preventDefault(); }}>開催のキット発送を確認 →</a> : null;
  const email = headquarters?.contactEmail ?? view?.contact.email;
  return <div className="space-y-4"><ApplicationAnswerSummary key={applicationId} applicationId={applicationId}/>
    <section className={card}><h1 className="text-base font-bold">申込情報</h1><Row label="販売プラン">{summary.planTitle}</Row><Row label="申込者">{summary.applicantName}</Row><Row label="受付">{summary.saleChannel === 'instructor' ? '講師販売' : '本部販売'}</Row><Row label="申込日">{applicationDate(summary.appliedAt)}</Row><Row label="メール">{email ? <a href={`mailto:${email}`}>{email}</a> : '未登録'}</Row>{summary.tuition && <><Row label="受講料">{new Intl.NumberFormat('ja-JP', { style: 'currency', currency: summary.tuition.currency || 'JPY' }).format(summary.tuition.amount)}</Row><Row label="入金状態">{status(summary.tuition.status)}</Row></>}<Row label="状態">{summary.statusLabel}</Row><Row label="次の対応">{summary.nextAction === 'event_kit_shipping' && eventLink ? eventLink : nextActionLabel(summary.nextAction)}</Row></section>
    <section className={card}><h2 className="text-sm font-bold">ステータス管理</h2><div className="grid gap-2 sm:grid-cols-3">
      {allowed.includes('confirm_payment') && <button className={button} disabled={busy} onClick={() => void execute('confirm_payment')}>入金済みにする</button>}
      {allowed.includes('confirm_completion') && <button className={button} disabled={busy || !note.trim()} onClick={() => void execute('confirm_completion', { review_note: note })}>受講完了にする</button>}
      {allowed.includes('confirm_certification') && <button className={button} disabled={busy || (summary.saleChannel === 'headquarters' && !note.trim())} onClick={() => void execute('confirm_certification', summary.saleChannel === 'headquarters' ? { review_note: note } : {})}>認定済みにする</button>}
    </div>{headquarters && (allowed.includes('confirm_completion') || allowed.includes('confirm_certification')) && <label className="block space-y-1 text-xs font-bold">確認内容<textarea className={inputClass} value={note} onChange={event => edit(setNote, event.target.value)} /></label>}
      <Row label="修了">{summary.completedAt ? applicationDate(summary.completedAt) : view ? status(view.completion.report) : '未確認'}</Row><Row label="認定">{summary.certifiedAt ? applicationDate(summary.certifiedAt) : '未認定'}</Row>
      {view && <><Row label="開講ライセンス">{status(view.openingLicense.status)}</Row>{view.progression.certify.state !== 'allow' && <p className="text-xs text-[var(--mikke-text-soft)]">{view.progression.certify.message || '受講者ごとの支払い・修了報告を確認後に認定できます。'}</p>}</>}
    </section>
    <section className={card}><h2 className="text-sm font-bold">開催・日程</h2><Row label="開始">{applicationDate(headquarters?.event?.startsAt ?? view?.schedule.startsAt)}</Row><Row label="終了">{applicationDate(headquarters?.event?.endsAt ?? view?.schedule.endsAt)}</Row>
      {allowed.includes('confirm_schedule') && <><label className="block space-y-1 text-xs font-bold">開始日時<input type="datetime-local" className={inputClass} value={starts} onChange={event => edit(setStarts, event.target.value)} /></label><label className="block space-y-1 text-xs font-bold">終了日時<input type="datetime-local" className={inputClass} value={ends} onChange={event => edit(setEnds, event.target.value)} /></label><button className={button} disabled={busy} onClick={() => void saveSchedule()}>日程を保存する</button></>}
      {!headquarters?.event && !view && <p className="text-xs">この申込に開催は登録されていません。</p>}
    </section>
    {shipping.required && <section className={card}><h2 className="text-sm font-bold">キット・発送</h2><Row label="発送状態">{status(shipping.status)}</Row><Row label="発送日">{applicationDate(shipping.shippedAt)}</Row>
      {eventKit ? <><p className="text-xs">担当講師へまとめて発送するキットです。この申込者の分が発送対象に含まれているか、開催詳細で確認できます。</p>{eventLink}</> : <><Row label="発送先">{shipping.address || '未確定'}</Row><Row label="追跡番号">{shipping.trackingNumber || '未登録'}</Row>
      {allowed.includes('set_shipping_destination') && <><label className="block space-y-1 text-xs font-bold">発送先<textarea className={inputClass} value={address} onChange={event => edit(setAddress, event.target.value)} /></label><button className={button} disabled={busy || !address.trim()} onClick={() => void execute('set_shipping_destination', { address })}>発送先を保存する</button></>}
      {allowed.includes('record_shipping') && <><label className="block space-y-1 text-xs font-bold">発送日時<input type="datetime-local" className={inputClass} value={shipped} onChange={event => edit(setShipped, event.target.value)} /></label><label className="block space-y-1 text-xs font-bold">追跡番号（任意）<input className={inputClass} value={tracking} onChange={event => edit(setTracking, event.target.value)} /></label><button className={button} disabled={busy || !shipped || !shipping.address} onClick={() => void execute('record_shipping', { shippedAt: new Date(`${shipped}:00+09:00`).toISOString(), trackingNumber: tracking || undefined })}>発送済みにする</button></>}
      </>}
    </section>}
    <div aria-live="polite" className="space-y-2 text-sm">{busy ? <p role="status">保存中…</p> : error ? <p role="alert" className="text-red-700">{error}</p> : saved ? <p role="status">{saved}</p> : dirty ? <p role="status">未保存の入力があります。</p> : null}<button className={button} disabled={busy} onClick={() => { setSaved(''); setRetry(value => value + 1); }}>最新の状態を読み込む</button>{dirty && <p className="text-xs">再読み込み後も入力中の内容は保持します。</p>}</div>
    <a className="block w-full rounded-xl border border-[var(--mikke-line)] bg-white px-4 py-3 text-center text-sm font-bold" href={toAcademyContextHref('/academy/offering-applications', hq.id, 'manage')}>一覧に戻る</a>
  </div>;
}

