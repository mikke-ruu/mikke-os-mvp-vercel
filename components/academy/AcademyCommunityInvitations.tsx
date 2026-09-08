"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { createCommunityAccessClient, instructorInvitationState, type AcademyCommunityOverviewData, type CommunityInvitationCommand } from "@/lib/academy/community-access-client";

export type CommunityInstructorRow = { id: string; name: string; canInvite?: boolean };
export type AcademyCommunityInvitationsProps = {
  headquartersId: string;
  communityId: string;
  userId: string;
  instructors?: CommunityInstructorRow[];
};
const control = "min-h-11 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm disabled:opacity-50";

export function AcademyCommunityInvitations(props: AcademyCommunityInvitationsProps) {
  const [auth, setAuth] = useState<{ userId: string; token: string } | null>(null);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session ? { userId: session.user.id, token: session.access_token } : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (!auth || auth.userId !== props.userId) return <p className="mt-3 text-sm" role="status">ログイン状態を確認しています。アカウントを変更した場合はページを再読み込みしてください。</p>;
  // Remount discards data, pending confirmations and requests across account/context changes.
  return <InvitationWorkspace key={`${props.headquartersId}:${props.communityId}:${auth.userId}:${auth.token}`} {...props} accessToken={auth.token} />;
}

function InvitationWorkspace({ headquartersId, communityId, instructors, accessToken }: AcademyCommunityInvitationsProps & { accessToken: string }) {
  const api = useMemo(() => createCommunityAccessClient(accessToken), [accessToken]);
  const [data, setData] = useState<AcademyCommunityOverviewData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("すべて");
  const [teacher, setTeacher] = useState("");
  const [mapping, setMapping] = useState("");
  const [rooms, setRooms] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{ command: CommunityInvitationCommand; description: string } | null>(null);
  const [checked, setChecked] = useState(false);
  const mutation = useRef<AbortController | null>(null);
  const locked = useRef(false);
  useEffect(() => () => { mutation.current?.abort(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(""); setConfirm(null); setChecked(false); setMapping(""); setRooms([]); setTeacher("");
    api.read(headquartersId, communityId, controller.signal).then(value => { if (!controller.signal.aborted) setData(value); }).catch(() => { if (!controller.signal.aborted) setError("Community情報を取得できませんでした。未契約や0名という意味ではありません。"); });
    return () => controller.abort();
  }, [api, headquartersId, communityId, revision]);

  async function execute() {
    if (!confirm || !checked || locked.current) return;
    locked.current = true; setBusy(true); setError(""); setNotice("");
    const controller = new AbortController(); mutation.current = controller;
    try {
      await api.mutate(confirm.command, controller.signal);
      if (controller.signal.aborted) return;
      setNotice(confirm.command.action === "issue" ? "招待を作成しました。下の招待リンクを先生本人にお知らせください。メールの自動送信は行いません。" : "取消を受け付けました。最新の状態を確認してください。");
      setRevision(value => value + 1);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setConfirm(null); setChecked(false); setData(null);
        setError(cause instanceof Error ? `${cause.message} 結果が不明な場合は再読み込みしてから操作してください。` : "結果を確認できませんでした。再読み込みしてから操作してください。");
      }
    } finally { locked.current = false; if (!controller.signal.aborted) setBusy(false); }
  }
  const option = data?.invitationOptions.items.find(item => item.mappingId === mapping);
  const candidate = data?.instructorCandidates.items.find(item => item.instructorId === teacher);
  const rows = instructors ?? [...new Set(data?.invitations.map(i => i.instructorId) ?? [])].map((id, index) => ({ id, name: `講師名未取得（${index + 1}）`, canInvite: false }));
  return <div className="mt-3 space-y-3 text-sm">
    {notice && <p role="status" className="rounded-lg border border-[#8bc7ad] p-3">{notice}</p>}
    {error ? <div role="alert"><p>{error}</p><button type="button" className={`${control} mt-2`} disabled={busy} onClick={() => setRevision(value => value + 1)}>再読み込み</button></div> : !data ? <p role="status">契約と招待状況を読み込んでいます…</p> : <>
      <div className="flex flex-wrap items-center gap-2"><strong>{data.community.name}</strong><span className="rounded-md border border-[var(--mikke-line)] px-2 py-1 text-xs">{data.contract.kind === "unavailable" ? "契約情報を確認できません" : data.contract.writeAllowed ? "Community利用中" : "Communityの利用を確認してください"}</span></div>
      {data.contract.kind === "available" && <p className="text-xs">現在の契約期間：{new Date(data.contract.currentPeriodEndsAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}まで（日本時間）</p>}
      <dl className="grid grid-cols-2 divide-x divide-[var(--mikke-line)] rounded-lg border border-[var(--mikke-line)] p-3 text-center"><div><dt>Communityの利用者</dt><dd className="text-lg font-bold">{data.activeMemberCount}名</dd></div><div><dt>招待履歴</dt><dd className="text-lg font-bold">{data.invitationCount}件</dd></div></dl>
      <p className="text-xs leading-5">利用者数はCommunity全体の人数です。「承諾済み」は招待の承諾履歴であり、現在の利用権を保証する表示ではありません。</p>
      {data.invitationsTruncated && <p role="status">招待履歴は直近200件です。表示範囲にない先生を未招待とは判断できません。</p>}
      {instructors === undefined && <p role="status">講師一覧を取得できていないため、招待履歴がある方だけを表示しています。</p>}
      <label className="flex flex-wrap items-center gap-2">招待状態<select className={control} value={filter} onChange={e => setFilter(e.target.value)}>{["すべて", "未招待", "招待中", "承諾済み", "招待期限切れ", "辞退", "取消済み", "利用終了", "履歴を確認できません"].map(value => <option key={value}>{value}</option>)}</select></label>
      <ul className="divide-y divide-[var(--mikke-line)]">{rows.filter(row => filter === "すべて" || instructorInvitationState(data, row.id).label === filter).map(row => {
        const state = instructorInvitationState(data, row.id);
        return <li key={row.id} className="space-y-2 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="break-words font-bold">{row.name}</span><span>{state.label}</span></div>
          {state.invitation?.status === "pending" && state.label === "招待中" && <p className="text-xs">招待期限：{new Date(state.invitation.expiresAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>}
          {state.invitation && ["pending", "accepted"].includes(state.invitation.status) && <div className="flex flex-wrap gap-2">
            {state.label === "招待中" && <button type="button" className={control} onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/community/academy-invitations/${encodeURIComponent(state.invitation!.id)}`).then(() => setNotice("招待リンクをコピーしました。先生本人にお知らせください。"), () => setError("招待リンクをコピーできませんでした。ブラウザの設定を確認してください。")); }}>招待リンクをコピー</button>}
            <button type="button" className={control} disabled={busy} onClick={() => { setChecked(false); setConfirm({ command: { action: "cancel", headquartersId, communityId, invitationId: state.invitation!.id }, description: `${row.name}さんの${state.invitation!.status === "accepted" ? "Academyから追加したRoomの利用を終了" : "招待を取消"}します。通常のCommunity会員資格と契約は変更しません。` }); }}>{state.invitation.status === "accepted" ? "追加した利用権を終了" : "招待を取り消す"}</button>
          </div>}
        </li>;
      })}</ul>
      {!rows.length && <p>表示できる講師はいません。</p>}
      <details className="rounded-lg border border-[var(--mikke-line)] p-3"><summary className="min-h-11 cursor-pointer font-bold">先生をCommunityに招待する</summary>
        {data.invitationOptions.state !== "available" || data.instructorCandidates.state !== "available" || !data.invitationOptions.items.length ? <p>{data.invitationOptions.reason === "academy_invitation_stopped" || data.instructorCandidates.reason === "academy_invitation_stopped" ? "有料移行の取消を受け付けているため、新しい招待は停止しています。" : "招待できる先生・Room・適用条件を確認できません。AcademyとCommunityの利用状態や連携設定を確認してください。"}</p> : !data.instructorCandidates.items.length ? <p>現在招待できる先生はいません。講師の登録状態とアカウントの接続を確認してください。</p> : data.contract.kind !== "available" || !data.contract.writeAllowed ? <p>Communityの利用状態を確認できるまで新しい招待はできません。</p> : <div className="space-y-3">
          <label className="block">招待する先生<select className={`${control} mt-1 w-full`} value={teacher} onChange={e => { setTeacher(e.target.value); setConfirm(null); setChecked(false); }}><option value="">先生を選んでください</option>{data.instructorCandidates.items.map(item => <option key={item.instructorId} value={item.instructorId}>{item.displayName}</option>)}</select></label>
          <label className="block">参加できる範囲<select className={`${control} mt-1 w-full`} value={mapping} onChange={e => { setMapping(e.target.value); setRooms([]); setConfirm(null); setChecked(false); }}><option value="">参加範囲を選んでください</option>{data.invitationOptions.items.map(item => <option key={item.mappingId} value={item.mappingId}>{item.rooms.map(room => room.name).join("・")}</option>)}</select></label>
          {option && <fieldset><legend>招待するRoom</legend>{option.rooms.map(room => <label key={room.id} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={rooms.includes(room.id)} onChange={e => { setRooms(old => e.target.checked ? [...old, room.id] : old.filter(id => id !== room.id)); setConfirm(null); setChecked(false); }} />{room.name}</label>)}</fieldset>}
          <button type="button" className={control} disabled={busy || !candidate || !option || !rooms.length} onClick={() => { if (!option || !candidate) return; setChecked(false); setConfirm({ command: { action: "issue", headquartersId, communityId, instructorId: candidate.instructorId, mappingId: option.mappingId, policyKey: option.policyKey, roomIds: rooms }, description: `${candidate.displayName}さんを「${data.community.name}」の${option.rooms.filter(room => rooms.includes(room.id)).map(room => room.name).join("、")}に招待します。先生本人が内容を確認して承諾すると参加できます。` }); }}>招待内容を確認</button>
        </div>}
      </details>
      {confirm && <section role="region" aria-label="Community操作の最終確認" className="space-y-3 rounded-lg border border-[#ffd370] p-3"><h3 className="font-bold">実行前の確認</h3><p>{confirm.description}</p><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={checked} disabled={busy} onChange={e => setChecked(e.target.checked)} />対象と内容を確認しました</label><div className="flex flex-wrap gap-2"><button type="button" className={control} disabled={busy} onClick={() => { setConfirm(null); setChecked(false); }}>戻る</button><button type="button" className={`${control} font-bold`} disabled={busy || !checked} onClick={() => void execute()}>{busy ? "処理しています…" : confirm.command.action === "issue" ? "この内容で招待を作成" : "取消を実行"}</button></div></section>}
    </>}
  </div>;
}
