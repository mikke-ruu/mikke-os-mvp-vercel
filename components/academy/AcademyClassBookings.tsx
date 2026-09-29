"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { assignPaidApplicationClass, bookingDate, cancelOfferingClassBooking, listAssignmentClasses, listClassBookings, listMyOfferingBookings, safeMeetingUrl, type AssignmentClass, type MyBooking, type RosterBooking } from "@/lib/academy/class-bookings";

const button = "min-h-11 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm disabled:opacity-50";
const changed = "academy-bookings-changed";
function announceChange() { window.dispatchEvent(new Event(changed)); }
function useReload() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("focus", refresh); window.addEventListener(changed, refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener(changed, refresh); };
  }, []);
  return [revision, () => setRevision(value => value + 1)] as const;
}

export function PaidApplicationAssignment(props: { applicationId: string; headquartersId: string; applicantName: string; paid: boolean }) {
  const { profile } = useAuth();
  if (!props.paid) return <p className="mt-3 text-sm text-[var(--mikke-muted)]">入金確認前は席を確保しません。</p>;
  return <Assignment key={`${profile.user_id}:${props.headquartersId}:${props.applicationId}`} {...props} />;
}
function Assignment({ applicationId, headquartersId, applicantName }: { applicationId: string; headquartersId: string; applicantName: string }) {
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState<AssignmentClass[]>([]);
  const [selected, setSelected] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, reload] = useReload();
  const operation = useRef<{ id: string; classId: string } | null>(null);
  const pending = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    void listAssignmentClasses(applicationId, headquartersId).then(items => {
      if (active) { setClasses(items); setSelected(value => items.some(item => item.id === value) ? value : ""); }
    }).catch(() => { if (active) setError("日程を読み込めませんでした。再読み込みしてください。"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, revision, applicationId, headquartersId]);
  const target = classes.find(item => item.id === selected);
  async function assign() {
    if (pending.current || (!target && !operation.current)) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    try {
      // Keep the same request after an uncertain response. A new choice is locked until resolved.
      operation.current ??= { id: crypto.randomUUID(), classId: selected };
      const result = await assignPaidApplicationClass(applicationId, operation.current.classId, operation.current.id);
      operation.current = null; setUncertain(false); setConfirming(false);
      setMessage(result.replayed ? "以前の操作結果を受け取りました。現在の席の状態は名簿を確認してください。" : result.outcome === "full" ? "満席のため席を確保できませんでした。主催者が別の日程を確認してください。" : result.booking?.status === "cancelled" ? "この割当は取消済みです。現在の名簿を確認してください。" : result.outcome === "already_assigned" ? "この方の席はすでに確保されています。" : "席を確保しました。");
      announceChange();
    } catch {
      setUncertain(true); setError("結果を確認できませんでした。同じ操作で結果を確認してください。席の状態は名簿でも確認できます。");
      announceChange();
    } finally { pending.current = false; setBusy(false); }
  }
  return <div className="mt-4 space-y-3 border-t border-[var(--mikke-line)] pt-3">
    <button type="button" className={button} onClick={() => setOpen(true)}>開催日程を割り当てる</button>
    {open ? <>
      <p className="text-sm">入金確認後、日程を割り当てると席を確保します。入金だけでは席は確定しません。</p>
      <button type="button" className={button} disabled={loading || busy} onClick={() => { setError(""); reload(); }}>日程を再読み込み</button>
      {loading ? <p role="status">日程を読み込み中…</p> : classes.length ? <label className="block text-sm">割り当てる日程
        <select aria-label="割り当てる日程" className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-2" disabled={busy || uncertain} value={selected} onChange={event => { setSelected(event.target.value); setConfirming(false); setMessage(""); }}>
          <option value="">日程を選択してください</option>
          {classes.map(item => <option key={item.id} value={item.id}>{item.title} / {bookingDate(item.starts_at)} / {item.remaining_capacity === null ? "定員なし" : item.remaining_capacity === 0 ? "満席" : `残り${item.remaining_capacity}席`}</option>)}
        </select>
      </label> : !error ? <p className="text-sm">この申込に割り当てられる日程はありません。購入した講座の日程と受付状態を確認してください。</p> : null}
      {target ? <div className="text-sm" aria-label="選択した日程"><p className="font-bold">{target.title}</p><p>{bookingDate(target.starts_at)}{target.ends_at ? ` 〜 ${bookingDate(target.ends_at)}` : ""}</p><p>{target.remaining_capacity === null ? "定員なし" : target.remaining_capacity === 0 ? "満席" : `残り${target.remaining_capacity}席`}</p></div> : null}
      {target ? <AcademyClassRoster classId={target.id} headquartersId={headquartersId} key={target.id} defaultOpen /> : null}
      {uncertain ? <button type="button" className={button} disabled={busy} onClick={() => void assign()}>同じ操作の結果を確認</button> : target && confirming ? <div className="space-y-2 rounded-lg bg-[var(--mikke-surface-soft)] p-3">
        <p className="text-sm">{applicantName}さんを「{target.title}」（{bookingDate(target.starts_at)}）へ割り当てます。</p>
        <button type="button" className={button} disabled={busy || loading} onClick={() => void assign()}>{busy ? "確認中…" : "この日程で席を確保"}</button>
        <button type="button" className={button} disabled={busy} onClick={() => setConfirming(false)}>戻る</button>
      </div> : <button type="button" className={button} disabled={!target || loading || busy || target.remaining_capacity === 0} onClick={() => setConfirming(true)}>割当内容を確認</button>}
      {target?.remaining_capacity === 0 && !message ? <p className="text-sm">この日程は満席です。別の日程を確認してください。</p> : null}
      <Link className="inline-flex min-h-11 items-center text-sm underline" href={toCurrentAcademyContextHref("/academy/classes")}>開催日程・名簿へ</Link>
    </> : null}
    {error ? <p role="alert" className="text-sm text-[var(--mikke-danger)]">{error}</p> : null}
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </div>;
}

export function AcademyClassRoster(props: { classId: string; headquartersId: string; defaultOpen?: boolean }) {
  const { profile } = useAuth();
  return <Roster key={`${profile.user_id}:${props.headquartersId}:${props.classId}`} {...props} />;
}
function Roster({ classId, headquartersId, defaultOpen = false }: { classId: string; headquartersId: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [items, setItems] = useState<RosterBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<RosterBooking | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const operation = useRef<{ id: string; bookingId: string } | null>(null);
  const pending = useRef(false);
  const [revision, reload] = useReload();
  useEffect(() => {
    if (!open) return;
    let active = true; setLoading(true); setItems([]);
    void listClassBookings(classId, headquartersId).then(rows => { if (active) setItems(rows); }).catch(() => { if (active) setError("名簿を読み込めませんでした。"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, revision, classId, headquartersId]);
  async function cancel() {
    if (pending.current || !selected) return;
    pending.current = true; setBusy(true); setError("");
    try {
      operation.current ??= { id: crypto.randomUUID(), bookingId: selected.id };
      await cancelOfferingClassBooking(operation.current.bookingId, operation.current.id);
      operation.current = null; setSelected(null); setUncertain(false); setMessage("席の割当を取り消しました。購入と教材の利用権は変わりません。"); announceChange();
    } catch { setUncertain(true); setError("取消の結果を確認できませんでした。同じ操作で結果を確認してください。"); reload(); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="mt-3 space-y-2">
    <button type="button" className={button} disabled={busy || loading} onClick={() => { setOpen(true); setError(""); reload(); }}>{open ? "名簿を再読み込み" : "名簿を確認"}</button>
    {open && (loading ? <p role="status">名簿を読み込み中…</p> : !error && !items.length ? <p className="text-sm">割り当てられた申込はありません。</p> : <ul className="space-y-2">{items.map(item => <li key={item.id} className="flex flex-wrap items-center gap-3 text-sm">
      <span>{item.learner_name} / {item.status === "assigned" ? "席を確保済み" : "割当取消済み"}</span>
      {item.status === "assigned" ? <button type="button" className={button} disabled={busy || uncertain} onClick={() => { setSelected(item); setMessage(""); }}>席の割当を取り消す</button> : null}
    </li>)}</ul>)}
    {selected ? <div className="rounded-lg bg-[var(--mikke-surface-soft)] p-3 text-sm"><p>{selected.learner_name}さんの席の割当を取り消します。購入の取消・返金・教材の利用権の取消は行いません。</p>
      <button type="button" className={button} disabled={busy} onClick={() => void cancel()}>{uncertain ? "同じ取消の結果を確認" : "席の割当取消を確定"}</button>
      {!uncertain ? <button type="button" className={button} disabled={busy} onClick={() => setSelected(null)}>戻る</button> : null}
    </div> : null}
    {error ? <p role="alert" className="text-sm text-[var(--mikke-danger)]">{error}</p> : null}
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </div>;
}

export function MyOfferingBookings({ userId, headquartersId }: { userId: string; headquartersId?: string }) {
  const [items, setItems] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, reload] = useReload();
  useEffect(() => {
    let active = true; setLoading(true); setItems([]); setError("");
    void listMyOfferingBookings(userId).then(rows => { if (active) setItems(rows.filter(row => !headquartersId || row.headquarters_id === headquartersId)); }).catch(() => { if (active) setError("開催日程を読み込めませんでした。"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, headquartersId, revision]);
  return <section className="space-y-3 rounded-lg border border-[var(--mikke-line)] p-4" aria-label="申込後の開催日程">
    <h2 className="font-bold">参加する日程</h2>
    <button type="button" className={button} disabled={loading} onClick={reload}>日程を再読み込み</button>
    {loading ? <p role="status">開催日程を読み込み中…</p> : error ? <p role="alert">{error}</p> : !items.length ? <p className="text-sm">まだ日程は割り当てられていません。入金確認後、主催者が日程を確認して席を確保します。</p> : <ul className="space-y-3">{items.map(item => {
      const active = item.status === "assigned" && item.class_status !== "cancelled";
      const url = active ? safeMeetingUrl(item.meeting_url) : null;
      return <li key={item.id} className="border-t border-[var(--mikke-line)] pt-3 text-sm">
        <h3 className="font-bold">{item.class_title}</h3><p>{bookingDate(item.starts_at)}{item.ends_at ? ` 〜 ${bookingDate(item.ends_at)}` : ""}</p>
        <p>{item.class_status === "cancelled" ? "開催中止" : item.status === "cancelled" ? "割当取消済み" : "席を確保済み"}</p>
        <p>{item.format === "online" ? "オンライン" : "対面"}{active && item.venue_name ? ` / ${item.venue_name}` : ""}</p>
        {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">オンライン会場を開く</a> : null}
      </li>;
    })}</ul>}
  </section>;
}
