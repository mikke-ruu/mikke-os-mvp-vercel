"use client";

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_BODIES, MAIL_KINDS, MAIL_SUBJECTS, renderPlainBody, validateBody } from '@/lib/academy/offering-mail-content.mjs';
import { getNotificationSettings, saveNotificationSettings, type NotificationKind, type NotificationSettings, type NotificationBodies } from '@/lib/academy/notification-settings';

const labels: Record<NotificationKind, string> = {
  receipt: '申込受付（受講者へ）', headquarters: '申込のお知らせ（本部へ）', materials: '入金確認後の案内（受講者へ）',
  instructor_registered: '講師登録完了（mikke ID登録済みの講師へ）', instructor_invitation: 'mikke ID登録・本人連携の案内', instructor_linked: '本人連携完了（講師へ）',
  instructor_order_headquarters: '旧申込の講座用教材注文（本部へ）', instructor_order_received: '旧申込の講座用教材注文（講師へ）',
};
const occasions: Record<NotificationKind, string> = {
  receipt: '申込の受付完了時に、申込者のmikke IDに登録された確認済みメールアドレスへ送ります。',
  headquarters: '申込の受付完了時に、本部責任者のmikke IDに登録された確認済みメールアドレスへ送ります。',
  materials: '入金確認が確定したときに、受講者のmikke IDに登録された確認済みメールアドレスへ送ります。',
  instructor_registered: '講師の正式登録が完了したときに、本人のmikke IDに登録された確認済みメールアドレスへ送ります。',
  instructor_invitation: 'mikke IDが未連携の講師へ登録・連携を案内するときに、本部が登録した連絡先へ送ります。メールを受け取っただけでは本人連携は完了しません。',
  instructor_linked: '講師名簿と本人のmikke IDの連携が完了したときに、本人の確認済みメールアドレスへ送ります。',
  instructor_order_headquarters: '旧申込に紐づく講座用教材の注文が受け付けられたときに、本部責任者へ送ります。現行サービスの仕入れ注文は対象外です。',
  instructor_order_received: '旧申込に紐づく講座用教材の注文が受け付けられたときに、発注した講師へ送ります。入金や利用権の付与を知らせるメールではありません。',
};
const insertions = [ ['name', 'お名前'], ['title', '講座・本部などの名称'], ['price', '金額'], ['materials_url', '教材URL'], ['applications_url', '申込確認URL'], ['manager_url', '本部の申込管理URL'], ['instructor_url', '講師マイページURL'], ['invitation_url', '本人確認URL'], ['order_url', '注文確認URL'] ] as const;
const sample = { application_id: '11111111-1111-4111-8111-111111111111', source_id: '33333333-3333-4333-8333-333333333333', headquarters_id: '22222222-2222-4222-8222-222222222222', name: '山田 はな（見本）', title: 'キャンドル体験（見本）', price: 5000, payment_method: 'bank', invitation_token: 'a'.repeat(64) };
const buttonClass = 'rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm disabled:opacity-50';

export function AcademyNotificationSettings({ headquartersId, canEdit, sampleOnly = false }: { headquartersId: string; canEdit: boolean; sampleOnly?: boolean }) {
  const [saved, setSaved] = useState<NotificationSettings | null>(null);
  const [draft, setDraft] = useState<NotificationSettings | null>(null);
  const [kind, setKind] = useState<NotificationKind>('receipt');
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const generation = useRef(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const request = ++generation.current;
    setSaved(null); setDraft(null); setLoading(true); setBusy(false); setError(''); setMessage('');
    const load = sampleOnly ? Promise.resolve({ version: 0, bodies: Object.fromEntries(MAIL_KINDS.map(kind => [kind, null])) as NotificationBodies }) : getNotificationSettings(headquartersId);
    void load.then(value => {
      if (request !== generation.current) return;
      setSaved(value); setDraft(value);
    }).catch(reason => {
      if (request === generation.current) setError(reason instanceof Error ? reason.message : 'メール本文を読み込めませんでした。');
    }).finally(() => { if (request === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [headquartersId, sampleOnly, reload]);

  const body = draft?.bodies[kind] ?? DEFAULT_BODIES(kind);
  const errors = draft ? Object.values(draft.bodies).flatMap(value => validateBody(value)) : [];
  const dirty = Boolean(draft && saved && JSON.stringify(draft.bodies) !== JSON.stringify(saved.bodies));
  const editable = canEdit && !busy && !loading && Boolean(draft);
  function change(value: string | null) {
    setDraft(current => current ? { ...current, bodies: { ...current.bodies, [kind]: value } } : current);
    setMessage('');
  }
  function insert(token: string) {
    const field = textarea.current;
    const start = field?.selectionStart ?? body.length, end = field?.selectionEnd ?? start;
    const text = `{{${token}}}`;
    change(body.slice(0, start) + text + body.slice(end));
    requestAnimationFrame(() => { field?.focus(); field?.setSelectionRange(start + text.length, start + text.length); });
  }
  async function save() {
    if (!draft || !canEdit || sampleOnly || busy || errors.length) return;
    const request = generation.current;
    setBusy(true); setMessage(''); setError('');
    try {
      const result = await saveNotificationSettings(headquartersId, draft);
      if (request !== generation.current) return;
      setSaved(result); setDraft(result); setMessage('メール本文を保存しました。これから受け付ける通知に反映されます。');
    } catch (reason) {
      if (request === generation.current) setError(reason instanceof Error ? reason.message : 'メール本文を保存できませんでした。');
    } finally { if (request === generation.current) setBusy(false); }
  }

  return <section aria-labelledby="academy-mail-heading" className="min-w-0 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5">
    <h2 id="academy-mail-heading" className="text-base font-bold">通知メールの本文</h2>
    <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">通知の場面ごとに本文を編集できます。宛先と件名、末尾の確認リンクは自動で設定されます。本文を保存するだけでは配信は開始されません。</p>
    {loading ? <p role="status" className="mt-4 text-sm">本文を読み込んでいます…</p> : draft ? <>
      <label className="mt-4 block text-sm font-bold">編集するメール
        <select className="mt-2 w-full min-w-0 rounded-xl border border-[var(--mikke-line)] bg-white p-3 font-normal" value={kind} onChange={event => { setKind(event.target.value as NotificationKind); setMessage(''); }} disabled={busy}>
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">{occasions[kind]}</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="メール本文の表示">
        <button type="button" className={buttonClass} aria-pressed={!preview} onClick={() => setPreview(false)}>本文を編集</button>
        <button type="button" className={buttonClass} aria-pressed={preview} onClick={() => setPreview(true)}>プレビュー</button>
      </div>
      {preview ? <div className="mt-4 min-w-0 rounded-xl bg-[var(--mikke-surface-soft)] p-4">
        <p className="text-xs text-[var(--mikke-muted)]">架空の名前・サービス・金額で表示しています。メールは送信しません。</p>
        <p className="my-3 break-words text-sm font-bold">件名：{MAIL_SUBJECTS[kind]}</p>
        {validateBody(draft.bodies[kind]).length ? <p role="alert" className="text-sm">差し込み項目と文字数を確認してください。</p> : <pre aria-label="メール本文の見本" className="whitespace-pre-wrap break-words font-sans text-sm leading-7 [overflow-wrap:anywhere]">{renderPlainBody(kind, draft.bodies[kind], sample)}</pre>}
      </div> : <div className="mt-4">
        <label className="block text-sm font-bold">本文
          <textarea ref={textarea} rows={9} value={body} onChange={event => change(event.target.value)} disabled={!editable} className="mt-2 w-full min-w-0 resize-y rounded-xl border border-[var(--mikke-line)] p-3 font-normal leading-7" />
        </label>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--mikke-muted)]"><span>{draft.bodies[kind] === null ? '既定の本文' : '編集した本文'}</span><span>{Array.from(body).length} / 4,000文字</span></div>
        <p className="mt-3 text-xs text-[var(--mikke-muted)]">本文に差し込む項目</p>
        <div className="mt-2 flex flex-wrap gap-2">{insertions.map(([token, label]) => <button type="button" key={token} className={buttonClass} disabled={!editable} onClick={() => insert(token)}>＋ {label}</button>)}</div>
        <button type="button" className={`${buttonClass} mt-3`} disabled={!editable || draft.bodies[kind] === null} onClick={() => change(null)}>既定の本文に戻す</button>
      </div>}
      {errors.length ? <p role="alert" className="mt-3 text-sm text-red-700">本文は4,000文字以内で入力してください。差し込みには上のボタンで追加できる項目を使ってください。</p> : null}
      <p className="mt-4 text-xs leading-6 text-[var(--mikke-muted)]">保存前の変更は、メールを切り替えても残ります。保存すると各メールの設定が反映されます。すでに送信待ちのメールの本文は変わりません。</p>
      <p className="mt-1 text-xs leading-6 text-[var(--mikke-muted)]">本文を書き換えても、申込金額や教材の閲覧権限は変わりません。</p>
      {sampleOnly ? <p className="mt-3 text-sm">操作確認用のため、変更は保存されません。</p> : <button type="button" onClick={() => void save()} disabled={!editable || !dirty || errors.length > 0} className="mt-4 rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? '保存中…' : 'メール本文を保存'}</button>}
      {dirty ? <span className="ml-3 text-xs text-[var(--mikke-muted)]">未保存の変更があります</span> : null}
      {!canEdit ? <p className="mt-3 text-sm">本部責任者または本部運営担当が、編集できる利用状態で変更できます。</p> : null}
    </> : null}
    {message ? <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p> : null}
    {error ? <div role="alert" className="mt-3 text-sm"><p>{error}</p><button type="button" className={`${buttonClass} mt-2`} disabled={busy} onClick={() => setReload(value => value + 1)}>保存済みの本文を読み直す</button></div> : null}
  </section>;
}
