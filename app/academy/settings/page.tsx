"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Check, ShieldCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { getOwnedHeadquarters, updateHeadquarters } from "@/lib/academy/headquarters";
import {
  getMyHeadquartersRole,
  inviteHeadquartersMember,
  listHeadquartersInvitations,
  listHeadquartersMembers,
  listMyHeadquartersInvitations,
  respondHeadquartersInvitation,
  stopHeadquartersMember
} from "@/lib/academy/headquarters-settings";
import type {
  AcademyHeadquarters,
  AcademyHeadquartersInvitation,
  AcademyHeadquartersMember,
  AcademyHeadquartersRole
} from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const cardClass = "rounded-2xl border border-[var(--mikke-line)] bg-white p-5";

const roleLabels: Record<AcademyHeadquartersRole, string> = {
  owner: "Owner",
  administrator: "Administrator",
  course_editor: "Course Editor"
};

const roleDetails = [
  { role: "Owner", permissions: "本部情報、メンバー、講座、公開を含むすべての管理" },
  { role: "Administrator", permissions: "本部情報、メンバー招待、講座運営（所有権の変更を除く）" },
  { role: "Course Editor", permissions: "講座、公開講座ページ、教材の編集" }
];

function SettingsContent() {
  const { profile } = useAuth();
  const [headquarters, setHeadquarters] = useState<AcademyHeadquarters | null>(null);
  const [role, setRole] = useState<AcademyHeadquartersRole | null>(null);
  const [members, setMembers] = useState<AcademyHeadquartersMember[]>([]);
  const [invitations, setInvitations] = useState<AcademyHeadquartersInvitation[]>([]);
  const [myInvitations, setMyInvitations] = useState<AcademyHeadquartersInvitation[]>([]);
  const [form, setForm] = useState({
    name: "",
    logo_url: "",
    contact_email: "",
    renewal_period_months: "",
    next_instructor_number: "",
    default_payment_note: ""
  });
  const [inviteMikkeId, setInviteMikkeId] = useState("");
  const [inviteRole, setInviteRole] =
    useState<Exclude<AcademyHeadquartersRole, "owner">>("administrator");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const canManage = role === "owner" || role === "administrator";

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const pending = await listMyHeadquartersInvitations(profile.id);
      setMyInvitations(pending);

      const hq = await getOwnedHeadquarters(profile.user_id);
      setHeadquarters(hq);
      if (!hq) {
        setRole(null);
        setMembers([]);
        setInvitations([]);
        return;
      }

      const nextRole = await getMyHeadquartersRole(hq.id);
      setRole(nextRole);
      setForm({
        name: hq.name,
        logo_url: hq.logo_url ?? "",
        contact_email: hq.contact_email ?? "",
        renewal_period_months: hq.renewal_period_months?.toString() ?? "",
        next_instructor_number: hq.next_instructor_number?.toString() ?? "",
        default_payment_note: hq.default_payment_note ?? ""
      });

      if (nextRole === "owner" || nextRole === "administrator") {
        const [nextMembers, nextInvitations] = await Promise.all([
          listHeadquartersMembers(hq.id),
          listHeadquartersInvitations(hq.id)
        ]);
        setMembers(nextMembers);
        setInvitations(nextInvitations);
      }
    } catch {
      setMessage("本部設定を読み込めませんでした。DB設定と権限を確認してください。");
    } finally {
      setLoading(false);
    }
  }, [profile.id, profile.user_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === "active"),
    [members]
  );

  async function saveProfile() {
    if (!headquarters || !canManage) return;
    setBusy("profile");
    setMessage("");
    try {
      const updated = await updateHeadquarters(headquarters.id, {
        name: form.name.trim() || headquarters.name,
        logo_url: form.logo_url.trim() || null,
        contact_email: form.contact_email.trim() || null,
        renewal_period_months: form.renewal_period_months
          ? Number(form.renewal_period_months)
          : null,
        next_instructor_number: form.next_instructor_number
          ? Number(form.next_instructor_number)
          : null,
        default_payment_note: form.default_payment_note.trim() || null
      });
      setHeadquarters(updated);
      setMessage("本部情報を保存しました。");
    } catch {
      setMessage("本部情報を保存できませんでした。");
    } finally {
      setBusy("");
    }
  }

  async function inviteMember() {
    if (!headquarters || !canManage || !inviteMikkeId.trim()) return;
    setBusy("invite");
    setMessage("");
    try {
      await inviteHeadquartersMember(headquarters.id, inviteMikkeId, inviteRole);
      setInviteMikkeId("");
      setMessage("本部メンバーへ招待を送りました。");
      await load();
    } catch {
      setMessage("招待を送れませんでした。mikke IDと権限を確認してください。");
    } finally {
      setBusy("");
    }
  }

  async function respond(invitationId: string, response: "accepted" | "declined") {
    setBusy(invitationId);
    setMessage("");
    try {
      await respondHeadquartersInvitation(invitationId, response);
      setMessage(response === "accepted" ? "本部への招待を承認しました。" : "招待を辞退しました。");
      await load();
    } catch {
      setMessage("招待へ回答できませんでした。");
    } finally {
      setBusy("");
    }
  }

  async function stopMember(memberId: string) {
    setBusy(memberId);
    setMessage("");
    try {
      await stopHeadquartersMember(memberId);
      setMessage("本部メンバーの利用を停止しました。");
      await load();
    } catch {
      setMessage("メンバーを停止できませんでした。Owner権限を確認してください。");
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">本部設定を確認しています…</p>;
  }

  return (
    <div className="space-y-5">
      {message ? (
        <p className="rounded-xl bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm font-bold text-[var(--mikke-accent-strong)]">
          {message}
        </p>
      ) : null}

      {myInvitations.length ? (
        <section className={cardClass}>
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--mikke-text)]">
            <UserPlus size={18} /> あなたへの本部招待
          </h2>
          <div className="mt-4 space-y-3">
            {myInvitations.map((invitation) => (
              <div key={invitation.id} className="rounded-xl border border-[var(--mikke-line)] p-4">
                <p className="text-sm font-bold">{invitation.headquarters?.name ?? "Academy本部"}</p>
                <p className="mt-1 text-xs text-[var(--mikke-muted)]">
                  役割: {roleLabels[invitation.role]}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy === invitation.id}
                    onClick={() => void respond(invitation.id, "declined")}
                    className="rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-sm font-bold"
                  >
                    辞退
                  </button>
                  <button
                    type="button"
                    disabled={busy === invitation.id}
                    onClick={() => void respond(invitation.id, "accepted")}
                    className="rounded-xl bg-[var(--mikke-primary)] px-3 py-2 text-sm font-bold text-white"
                  >
                    承認
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!headquarters ? (
        <p className={cardClass}>管理できる本部はありません。本部Ownerからの招待を確認してください。</p>
      ) : (
        <>
          <section className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold text-[var(--mikke-text)]">
                  <Building2 size={18} /> 本部情報
                </h2>
                <p className="mt-1 text-sm text-[var(--mikke-muted)]">
                  公開ページの文章ではなく、本部運営に使う基本情報です。
                </p>
              </div>
              {role ? (
                <span className="rounded-full bg-[var(--mikke-surface-soft)] px-3 py-1 text-xs font-bold">
                  {roleLabels[role]}
                </span>
              ) : null}
            </div>

            {canManage ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-xs font-bold">本部名<input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label className="text-xs font-bold">ロゴURL<input className={inputClass} value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} /></label>
                <label className="text-xs font-bold">問い合わせメール<input type="email" className={inputClass} value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></label>
                <label className="text-xs font-bold">認定の更新周期（月）<input type="number" min="1" className={inputClass} value={form.renewal_period_months} onChange={(e) => setForm({ ...form, renewal_period_months: e.target.value })} /></label>
                <label className="text-xs font-bold">次の講師番号<input type="number" min="1" className={inputClass} value={form.next_instructor_number} onChange={(e) => setForm({ ...form, next_instructor_number: e.target.value })} /></label>
                <label className="text-xs font-bold md:col-span-2">支払い案内の既定文<textarea rows={3} className={inputClass} value={form.default_payment_note} onChange={(e) => setForm({ ...form, default_payment_note: e.target.value })} /></label>
                <button type="button" disabled={busy === "profile"} onClick={() => void saveProfile()} className="rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white md:col-span-2">
                  本部情報を保存
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--mikke-muted)]">Course Editorは本部情報を変更できません。</p>
            )}
          </section>

          <section className={cardClass}>
            <h2 className="flex items-center gap-2 text-base font-bold"><ShieldCheck size={18} /> 役割・権限</h2>
            <div className="mt-4 space-y-2">
              {roleDetails.map((item) => (
                <div key={item.role} className="rounded-xl bg-[var(--mikke-surface-soft)] px-4 py-3">
                  <p className="text-sm font-bold">{item.role}</p>
                  <p className="mt-1 text-xs text-[var(--mikke-muted)]">{item.permissions}</p>
                </div>
              ))}
            </div>
          </section>

          {canManage ? (
            <section className={cardClass}>
              <h2 className="flex items-center gap-2 text-base font-bold"><UserPlus size={18} /> 本部メンバー</h2>
              <p className="mt-1 text-sm text-[var(--mikke-muted)]">mikke IDで招待し、本人が承認すると利用可能になります。</p>
              <div className="mt-4 grid gap-2 md:grid-cols-[1fr_12rem_auto]">
                <input className={inputClass} value={inviteMikkeId} onChange={(e) => setInviteMikkeId(e.target.value)} placeholder="mikke ID" />
                <select className={inputClass} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Exclude<AcademyHeadquartersRole, "owner">)}>
                  <option value="administrator">Administrator</option>
                  <option value="course_editor">Course Editor</option>
                </select>
                <button type="button" disabled={!inviteMikkeId.trim() || busy === "invite"} onClick={() => void inviteMember()} className="rounded-xl bg-[var(--mikke-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  招待
                </button>
              </div>

              <div className="mt-5 space-y-2">
                <div className="flex items-center gap-2 rounded-xl bg-[var(--mikke-surface-soft)] px-4 py-3">
                  <Check size={16} />
                  <div><p className="text-sm font-bold">本部Owner</p><p className="text-xs text-[var(--mikke-muted)]">Owner ・ 利用中</p></div>
                </div>
                {activeMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--mikke-line)] px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{member.member?.display_name ?? "本部メンバー"} <span className="font-normal text-[var(--mikke-muted)]">@{member.member?.handle ?? ""}</span></p>
                      <p className="text-xs text-[var(--mikke-muted)]">{roleLabels[member.role]}</p>
                    </div>
                    <button type="button" disabled={busy === member.id || (role === "administrator" && member.role === "administrator")} onClick={() => void stopMember(member.id)} className="rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold disabled:opacity-40">
                      利用停止
                    </button>
                  </div>
                ))}
              </div>

              {invitations.some((item) => item.status === "pending") ? (
                <div className="mt-5">
                  <p className="text-xs font-bold">回答待ち</p>
                  {invitations.filter((item) => item.status === "pending").map((invitation) => (
                    <p key={invitation.id} className="mt-2 rounded-xl bg-[var(--mikke-surface-soft)] px-4 py-3 text-sm">
                      @{invitation.target?.handle ?? ""} ・ {roleLabels[invitation.role]}
                    </p>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function AcademySettingsPage() {
  return (
    <HonbuShell title="本部設定">
      <SettingsContent />
    </HonbuShell>
  );
}
