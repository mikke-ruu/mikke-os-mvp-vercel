"use client";

import { FormEvent, ReactNode, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Check, CircleHelp, FileText, MessageCircleWarning, ShieldCheck, Trash2, UserCheck } from "lucide-react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import {
  addCommunityBlockedWord,
  communityErrorMessage,
  createCommunityInquiry,
  createCommunityReport,
  deleteCommunityBlockedWord,
  reviewCommunityJoinApplication,
  saveCommunitySafetySettings,
  updateCommunityInquiryStatus,
  updateCommunityReportStatus
} from "@/lib/community/client";
import type { CommunityDashboard, CommunityInquiryStatus, CommunityReportStatus, CommunitySafetySettings } from "@/lib/community/types";
import { supabase } from "@/lib/supabase/client";

type MutationProps = {
  data: CommunityDashboard;
  userId: string;
  onReload: () => Promise<void>;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
};

const inputClass = "mt-2 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--mikke-accent)]";
const cardClass = "rounded-xl border border-[var(--mikke-line)] bg-white p-5";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function CommunityRulesView({ data }: { data: CommunityDashboard }) {
  const settings = data.safetySettings;
  if (!settings) return <MikkeEmptyState title="Communityルールは準備中です" helper="運営者が公開すると、こちらで確認できます。" />;
  return <section className="space-y-4 border-t border-[var(--mikke-line)] pt-5">
    <div><p className="text-xs font-bold tracking-[0.18em] text-[var(--mikke-primary)]">SAFE COMMUNITY</p><h2 className="mt-2 text-2xl font-bold">ルールと大切なお知らせ</h2><p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">参加中もいつでも確認できます。大きな変更がある場合は再同意をお願いします。</p></div>
    <RuleCard icon={ShieldCheck} title={`Communityルール（第${settings.rulesVersion}版）`} text={settings.rulesText} />
    <RuleCard icon={FileText} title={`Community利用規約（第${settings.termsVersion}版）`} text={settings.termsText} />
    <RuleCard icon={UserCheck} title={`個人情報の取扱い（第${settings.privacyVersion}版）`} text={settings.privacyText} />
  </section>;
}

function RuleCard({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return <article className={cardClass}><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--mikke-yellow-soft)] text-[var(--mikke-primary)]"><Icon size={19} /></span><h3 className="font-bold">{title}</h3></div><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-muted)]">{text}</p></article>;
}

export function CommunityHelpView(props: MutationProps) {
  const { data, userId, onReload, onMessage, onError } = props;
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"report" | "inquiry">("report");
  const [saving, setSaving] = useState(false);
  const initialTarget = searchParams.get("target");
  const [targetType, setTargetType] = useState<"post" | "comment" | "chat" | "profile" | "member" | "other">(
    initialTarget === "comment" || initialTarget === "chat" || initialTarget === "profile" || initialTarget === "member" || initialTarget === "other" ? initialTarget : "post"
  );
  const [targetId, setTargetId] = useState(searchParams.get("id") ?? "");
  const [reason, setReason] = useState("rule_violation");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState("usage");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  async function submitReport(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      await createCommunityReport(supabase, { communityId: data.community.id, reporterUserId: userId, targetType, targetId: targetId || undefined, reason, details });
      setTargetId(""); setDetails(""); onMessage("通報を受け付けました。通報者の情報は対象者へ表示されません。"); await onReload();
    } catch (error) { onError(communityErrorMessage(error, "通報を送信できませんでした。")); } finally { setSaving(false); }
  }

  async function submitInquiry(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      await createCommunityInquiry(supabase, { communityId: data.community.id, userId, category, subject, body });
      setSubject(""); setBody(""); onMessage("問い合わせを受け付けました。"); await onReload();
    } catch (error) { onError(communityErrorMessage(error, "問い合わせを送信できませんでした。")); } finally { setSaving(false); }
  }

  return <section className="border-t border-[var(--mikke-line)] pt-5">
    <p className="text-xs font-bold tracking-[0.18em] text-[var(--mikke-primary)]">HELP & SAFETY</p><h2 className="mt-2 text-2xl font-bold">通報・問い合わせ</h2>
    <div className="mt-5 grid grid-cols-2 rounded-lg border border-[var(--mikke-line)] p-1"><button type="button" onClick={() => setMode("report")} className={`rounded-md px-3 py-2 text-sm font-bold ${mode === "report" ? "bg-[var(--mikke-yellow)] text-[var(--mikke-primary)]" : "text-[var(--mikke-muted)]"}`}>通報する</button><button type="button" onClick={() => setMode("inquiry")} className={`rounded-md px-3 py-2 text-sm font-bold ${mode === "inquiry" ? "bg-[var(--mikke-yellow)] text-[var(--mikke-primary)]" : "text-[var(--mikke-muted)]"}`}>問い合わせる</button></div>
    {mode === "report" ? <form onSubmit={submitReport} className={`mt-4 ${cardClass}`}><p className="flex items-center gap-2 font-bold"><AlertTriangle size={18} />問題のある内容を運営へ知らせる</p><label className="mt-4 block text-sm font-bold">対象<select value={targetType} onChange={(e) => setTargetType(e.target.value as typeof targetType)} className={inputClass}><option value="post">投稿</option><option value="comment">コメント</option><option value="chat">チャット</option><option value="profile">プロフィール</option><option value="member">参加者</option><option value="other">その他</option></select></label><label className="mt-4 block text-sm font-bold">対象ID（分かる場合）<input value={targetId} onChange={(e) => setTargetId(e.target.value)} className={inputClass} /></label><label className="mt-4 block text-sm font-bold">理由<select value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass}><option value="harassment">誹謗中傷・嫌がらせ</option><option value="personal_information">個人情報の掲載</option><option value="spam">スパム・宣伝</option><option value="impersonation">なりすまし</option><option value="inappropriate">不適切な内容</option><option value="rights">著作権・権利侵害</option><option value="danger">危険行為</option><option value="rule_violation">ルール違反</option><option value="other">その他</option></select></label><label className="mt-4 block text-sm font-bold">状況<textarea required rows={5} value={details} onChange={(e) => setDetails(e.target.value)} className={inputClass} /></label><button disabled={saving} className="mt-4 rounded-lg bg-[var(--mikke-accent)] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "送信中..." : "通報を送る"}</button></form> : null}
    {mode === "inquiry" ? <form onSubmit={submitInquiry} className={`mt-4 ${cardClass}`}><p className="flex items-center gap-2 font-bold"><CircleHelp size={18} />運営へ問い合わせる</p><label className="mt-4 block text-sm font-bold">種類<select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}><option value="usage">使い方</option><option value="account">登録・ログイン</option><option value="event">イベント・サービス</option><option value="privacy">退会・個人情報</option><option value="billing">支払い</option><option value="other">その他</option></select></label><label className="mt-4 block text-sm font-bold">件名<input required value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} /></label><label className="mt-4 block text-sm font-bold">内容<textarea required rows={5} value={body} onChange={(e) => setBody(e.target.value)} className={inputClass} /></label><button disabled={saving} className="mt-4 rounded-lg bg-[var(--mikke-accent)] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "送信中..." : "問い合わせを送る"}</button></form> : null}
    <div className="mt-6 grid gap-3 md:grid-cols-2">{data.reports.map((item) => <HistoryCard key={item.id} title={`通報：${item.reason}`} status={item.status} date={item.createdAt} note={item.resolutionNote} />)}{data.inquiries.map((item) => <HistoryCard key={item.id} title={item.subject} status={item.status} date={item.createdAt} note={item.responseNote} />)}</div>
  </section>;
}

function HistoryCard({ title, status, date, note }: { title: string; status: string; date: string; note: string | null }) {
  return <article className={cardClass}><div className="flex items-center justify-between gap-3"><p className="font-bold">{title}</p><MikkeStatusBadge tone={status === "resolved" || status === "answered" || status === "closed" ? "success" : "muted"}>{status}</MikkeStatusBadge></div><p className="mt-2 text-xs text-[var(--mikke-muted)]">{formatDate(date)}</p>{note ? <p className="mt-3 text-sm leading-6">運営から：{note}</p> : null}</article>;
}

export function OwnerCommunitySafetyView(props: MutationProps & { ownerLike: boolean }) {
  const { data, userId, ownerLike, onReload, onMessage, onError } = props;
  const current = data.safetySettings;
  const [settings, setSettings] = useState<CommunitySafetySettings | null>(current);
  const [word, setWord] = useState("");
  const [wordAction, setWordAction] = useState<"warn" | "block">("block");
  const [saving, setSaving] = useState(false);
  if (!ownerLike) return <MikkeEmptyState title="運営権限が必要です" helper="オーナーまたは共同運営者が設定できます。" />;
  if (!settings) return <MikkeEmptyState title="安全設定を読み込めません" helper="データベース設定を確認してください。" />;
  const update = <K extends keyof CommunitySafetySettings>(key: K, value: CommunitySafetySettings[K]) => setSettings({ ...settings, [key]: value });

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try { const { communityId: _, ...input } = settings!; await saveCommunitySafetySettings(supabase, data.community.id, input); onMessage("参加・安全設定を保存しました。"); await onReload(); }
    catch (error) { onError(communityErrorMessage(error, "安全設定を保存できませんでした。")); } finally { setSaving(false); }
  }
  async function addWord(event: FormEvent) {
    event.preventDefault(); if (!word.trim()) return;
    try { await addCommunityBlockedWord(supabase, data.community.id, userId, word, wordAction); setWord(""); onMessage("禁止ワードを追加しました。"); await onReload(); }
    catch (error) { onError(communityErrorMessage(error, "禁止ワードを追加できませんでした。")); }
  }
  async function removeWord(id: string) { try { await deleteCommunityBlockedWord(supabase, id); await onReload(); } catch (error) { onError(communityErrorMessage(error, "削除できませんでした。")); } }

  return <section className="space-y-5 border-t border-[var(--mikke-line)] pt-5"><div><p className="text-xs font-bold tracking-[0.18em] text-[var(--mikke-primary)]">SAFETY SETTINGS</p><h2 className="mt-2 text-2xl font-bold">参加・ルール設定</h2></div>
    <form onSubmit={save} className={cardClass}><h3 className="font-bold">参加申請</h3><label className="mt-4 block text-sm font-bold">承認方法<select value={settings.approvalMode} onChange={(e) => update("approvalMode", e.target.value as "auto" | "manual")} className={inputClass}><option value="manual">運営者が確認して承認</option><option value="auto">入力・同意後すぐ参加</option></select></label><div className="mt-4 grid gap-3 sm:grid-cols-3"><CheckField label="氏名を必須" checked={settings.requireLegalName} onChange={(v) => update("requireLegalName", v)} /><CheckField label="電話番号を必須" checked={settings.requirePhone} onChange={(v) => update("requirePhone", v)} /><CheckField label="参加目的を必須" checked={settings.requireJoinReason} onChange={(v) => update("requireJoinReason", v)} /></div>
      <TextVersionEditor title="利用規約" version={settings.termsVersion} text={settings.termsText} onVersion={(v) => update("termsVersion", v)} onText={(v) => update("termsText", v)} /><TextVersionEditor title="Communityルール" version={settings.rulesVersion} text={settings.rulesText} onVersion={(v) => update("rulesVersion", v)} onText={(v) => update("rulesText", v)} /><TextVersionEditor title="個人情報の取扱い" version={settings.privacyVersion} text={settings.privacyText} onVersion={(v) => update("privacyVersion", v)} onText={(v) => update("privacyText", v)} />
      <div className="mt-5 rounded-lg bg-[var(--mikke-surface-soft)] p-4"><CheckField label="参加直後の投稿回数を制限する（任意）" checked={settings.newMemberLimitEnabled} onChange={(v) => update("newMemberLimitEnabled", v)} />{settings.newMemberLimitEnabled ? <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-bold">参加後の時間<input type="number" min={1} max={168} value={settings.newMemberLimitHours} onChange={(e) => update("newMemberLimitHours", Number(e.target.value))} className={inputClass} /></label><label className="text-xs font-bold">投稿・返信の合計回数<input type="number" min={1} max={100} value={settings.newMemberMaxActions} onChange={(e) => update("newMemberMaxActions", Number(e.target.value))} className={inputClass} /></label></div> : null}</div><button disabled={saving} className="mt-5 rounded-lg bg-[var(--mikke-accent)] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "保存中..." : "設定を保存"}</button>
    </form>
    <section className={cardClass}><h3 className="font-bold">禁止ワード</h3><p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">「警告」は投稿前に注意を表示し、「禁止」はDB側でも送信を止めます。</p><form onSubmit={addWord} className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={word} onChange={(e) => setWord(e.target.value)} placeholder="単語・表現" className="min-w-0 flex-1 rounded-lg border border-[var(--mikke-line)] px-4 py-3" /><select value={wordAction} onChange={(e) => setWordAction(e.target.value as "warn" | "block")} className="rounded-lg border border-[var(--mikke-line)] px-4 py-3"><option value="block">禁止</option><option value="warn">警告</option></select><button className="rounded-lg bg-[var(--mikke-primary)] px-5 py-3 text-sm font-bold text-white">追加</button></form><div className="mt-4 flex flex-wrap gap-2">{data.blockedWords.map((item) => <span key={item.id} className="inline-flex items-center gap-2 rounded-full border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">{item.term}<span className="text-[var(--mikke-muted)]">{item.action === "block" ? "禁止" : "警告"}</span><button type="button" aria-label={`${item.term}を削除`} onClick={() => removeWord(item.id)}><Trash2 size={14} /></button></span>)}</div></section>
    <section className={cardClass}><div className="flex items-center justify-between gap-3"><h3 className="font-bold">参加申請</h3><MikkeStatusBadge tone="primary">{data.joinApplications.filter((item) => item.status === "pending").length}件待ち</MikkeStatusBadge></div><div className="mt-4 space-y-3">{data.joinApplications.map((item) => <ApplicationCard key={item.id} item={item} onReview={async (decision, note) => { try { await reviewCommunityJoinApplication(supabase, item.id, decision, note); onMessage(decision === "approved" ? "参加を承認しました。" : "参加申請を却下しました。"); await onReload(); } catch (error) { onError(communityErrorMessage(error, "参加申請を更新できませんでした。")); } }} />)}</div>{data.joinApplications.length === 0 ? <p className="mt-4 text-sm text-[var(--mikke-muted)]">参加申請はまだありません。</p> : null}</section>
  </section>;
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-start gap-2 text-sm font-bold"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" />{label}</label>; }
function TextVersionEditor({ title, version, text, onVersion, onText }: { title: string; version: number; text: string; onVersion: (value: number) => void; onText: (value: string) => void }) { return <fieldset className="mt-5 border-t border-[var(--mikke-line-soft)] pt-4"><legend className="font-bold">{title}</legend><label className="mt-3 block text-xs font-bold">バージョン<input type="number" min={1} value={version} onChange={(e) => onVersion(Number(e.target.value))} className={`${inputClass} max-w-32`} /></label><label className="mt-3 block text-xs font-bold">本文<textarea required rows={6} value={text} onChange={(e) => onText(e.target.value)} className={inputClass} /></label></fieldset>; }

function ApplicationCard({ item, onReview }: { item: CommunityDashboard["joinApplications"][number]; onReview: (decision: "approved" | "rejected", note: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  return <article className="rounded-lg border border-[var(--mikke-line-soft)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{item.displayName} <span className="text-xs font-normal text-[var(--mikke-muted)]">（{item.legalName ?? "氏名未入力"}）</span></p><p className="mt-1 text-xs text-[var(--mikke-muted)]">{item.email} / {item.phone ?? "電話番号なし"}</p><p className="mt-1 text-xs text-[var(--mikke-muted)]">{formatDate(item.submittedAt)}</p></div><MikkeStatusBadge tone={item.status === "approved" ? "success" : item.status === "pending" ? "primary" : "muted"}>{item.status}</MikkeStatusBadge></div>{item.joinReason ? <p className="mt-3 rounded-lg bg-[var(--mikke-surface-soft)] p-3 text-sm leading-6">参加目的：{item.joinReason}</p> : null}{item.status === "pending" ? <div className="mt-3"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="対応メモ（任意）" className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" /><div className="mt-2 flex gap-2"><button type="button" onClick={() => onReview("approved", note)} className="inline-flex items-center gap-1 rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white"><Check size={14} />承認</button><button type="button" onClick={() => onReview("rejected", note)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-danger)]">却下</button></div></div> : null}</article>;
}

export function OwnerCommunityModerationView(props: MutationProps & { ownerLike: boolean }) {
  const { data, userId, ownerLike, onReload, onMessage, onError } = props;
  if (!ownerLike) return <MikkeEmptyState title="運営権限が必要です" helper="オーナーまたは共同運営者が対応できます。" />;
  return <section className="space-y-5 border-t border-[var(--mikke-line)] pt-5"><div><p className="text-xs font-bold tracking-[0.18em] text-[var(--mikke-primary)]">MODERATION</p><h2 className="mt-2 text-2xl font-bold">通報・問い合わせ対応</h2></div><ModerationList title="通報" icon={MessageCircleWarning} empty="未対応の通報はありません。" items={data.reports} render={(item) => <ModerationReportCard key={item.id} item={item} onSave={async (status, note) => { try { await updateCommunityReportStatus(supabase, item.id, status, note, userId); onMessage("通報の対応状況を更新しました。"); await onReload(); } catch (error) { onError(communityErrorMessage(error, "通報を更新できませんでした。")); } }} />} /><ModerationList title="問い合わせ" icon={CircleHelp} empty="問い合わせはありません。" items={data.inquiries} render={(item) => <ModerationInquiryCard key={item.id} item={item} onSave={async (status, note) => { try { await updateCommunityInquiryStatus(supabase, item.id, status, note, userId); onMessage("問い合わせの対応状況を更新しました。"); await onReload(); } catch (error) { onError(communityErrorMessage(error, "問い合わせを更新できませんでした。")); } }} />} /></section>;
}

function ModerationList<T>({ title, icon: Icon, empty, items, render }: { title: string; icon: typeof CircleHelp; empty: string; items: T[]; render: (item: T) => ReactNode }) { return <section className={cardClass}><h3 className="flex items-center gap-2 font-bold"><Icon size={18} />{title}</h3><div className="mt-4 space-y-3">{items.map(render)}</div>{items.length === 0 ? <p className="mt-4 text-sm text-[var(--mikke-muted)]">{empty}</p> : null}</section>; }
function ModerationReportCard({ item, onSave }: { item: CommunityDashboard["reports"][number]; onSave: (status: CommunityReportStatus, note: string) => Promise<void> }) { const [status, setStatus] = useState<CommunityReportStatus>(item.status); const [note, setNote] = useState(item.resolutionNote ?? ""); return <article className="rounded-lg border border-[var(--mikke-line-soft)] p-4"><p className="font-bold">{item.targetType} / {item.reason}</p><p className="mt-1 text-xs text-[var(--mikke-muted)]">{formatDate(item.createdAt)} / 対象ID：{item.targetId ?? "なし"}</p>{item.details ? <p className="mt-3 text-sm leading-6">{item.details}</p> : null}<StatusEditor status={status} statuses={["open", "reviewing", "resolved", "dismissed"]} note={note} onStatus={(v) => setStatus(v as CommunityReportStatus)} onNote={setNote} onSave={() => onSave(status, note)} /></article>; }
function ModerationInquiryCard({ item, onSave }: { item: CommunityDashboard["inquiries"][number]; onSave: (status: CommunityInquiryStatus, note: string) => Promise<void> }) { const [status, setStatus] = useState<CommunityInquiryStatus>(item.status); const [note, setNote] = useState(item.responseNote ?? ""); return <article className="rounded-lg border border-[var(--mikke-line-soft)] p-4"><p className="font-bold">{item.subject}</p><p className="mt-1 text-xs text-[var(--mikke-muted)]">{item.category} / {formatDate(item.createdAt)}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.body}</p><StatusEditor status={status} statuses={["open", "reviewing", "answered", "closed"]} note={note} onStatus={(v) => setStatus(v as CommunityInquiryStatus)} onNote={setNote} onSave={() => onSave(status, note)} /></article>; }
function StatusEditor({ status, statuses, note, onStatus, onNote, onSave }: { status: string; statuses: string[]; note: string; onStatus: (value: string) => void; onNote: (value: string) => void; onSave: () => void }) { return <div className="mt-4 grid gap-2 sm:grid-cols-[160px_1fr_auto]"><select value={status} onChange={(e) => onStatus(e.target.value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm">{statuses.map((value) => <option key={value} value={value}>{value}</option>)}</select><input value={note} onChange={(e) => onNote(e.target.value)} placeholder="対応内容・返信" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" /><button type="button" onClick={onSave} className="rounded-lg bg-[var(--mikke-primary)] px-4 py-2 text-xs font-bold text-white">保存</button></div>; }
