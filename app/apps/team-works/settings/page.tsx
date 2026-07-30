"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clipboard, LoaderCircle, Mail, UserCog, UserPlus } from "lucide-react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { TeamWorksOperationsShell } from "@/components/team-works/operations/TeamWorksOperationsShell";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "@/components/team-works/projects/TeamWorksProjectsShell";
import { useTeamWorksLabels } from "@/components/team-works/useTeamWorksLabels";
import { supabase } from "@/lib/supabase/client";
import { DEFAULT_LABELS, loadTeamWorksLabels, updateTeamWorksLabels, type TeamWorksLabels } from "@/lib/team-works-labels";
import {
  DEFAULT_OPERATION_SETTINGS,
  loadOrganizationOperationSettings,
  updateOrganizationOperationSettings
} from "@/lib/team-works-operation-settings";
import {
  archiveOperationsOrganizationMember,
  createOperationsStaffInvite,
  loadOperationsOrganizationProfile,
  loadOperationsOrganizationMembers,
  updateOperationsOrganizationProfile,
  type OperationsOrganizationProfile,
  type OperationsOrganizationMemberEntry
} from "@/lib/team-works-operations-project";

const weekdayChipLabels = ["日", "月", "火", "水", "木", "金", "土"];

function roleLabel(role: string, labels: TeamWorksLabels) {
  if (role === "owner") return "オーナー";
  if (role === "manager") return "マネージャー";
  if (role === "client_user") return "クライアント";
  if (role === "worker") return labels.workers;
  return role;
}

function TeamWorksSettingsContent() {
  const labels = useTeamWorksLabels();
  const [members, setMembers] = useState<OperationsOrganizationMemberEntry[]>([]);
  const [organization, setOrganization] = useState<OperationsOrganizationProfile | null>(null);
  const [organizationForm, setOrganizationForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    shiftSubmissionDeadlineDay: "25",
    otherDeadlineDay: "",
    paymentDay: ""
  });
  const [organizationNotice, setOrganizationNotice] = useState("");
  const [labelForm, setLabelForm] = useState({ workers: DEFAULT_LABELS.workers, holidayLabel: DEFAULT_LABELS.holidayLabel });
  const [savingLabels, setSavingLabels] = useState(false);
  const [labelsNotice, setLabelsNotice] = useState("");
  const [operationForm, setOperationForm] = useState({
    closedWeekdays: DEFAULT_OPERATION_SETTINGS.closedWeekdays,
    closeOnNationalHolidays: DEFAULT_OPERATION_SETTINGS.closeOnNationalHolidays
  });
  const [savingOperationSettings, setSavingOperationSettings] = useState(false);
  const [operationNotice, setOperationNotice] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [savingOrganization, setSavingOrganization] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [memberRows, organizationProfile] = await Promise.all([
        loadOperationsOrganizationMembers(supabase),
        loadOperationsOrganizationProfile(supabase)
      ]);
      setMembers(memberRows);
      setOrganization(organizationProfile);
      if (organizationProfile) {
        setOrganizationForm({
          name: organizationProfile.name,
          email: organizationProfile.email ?? "",
          phone: organizationProfile.phone ?? "",
          address: organizationProfile.address ?? "",
          shiftSubmissionDeadlineDay: String(organizationProfile.shiftSubmissionDeadlineDay),
          otherDeadlineDay: organizationProfile.otherDeadlineDay ? String(organizationProfile.otherDeadlineDay) : "",
          paymentDay: organizationProfile.paymentDay ? String(organizationProfile.paymentDay) : ""
        });
        const [orgLabels, orgOperationSettings] = await Promise.all([
          loadTeamWorksLabels(supabase, organizationProfile.id),
          loadOrganizationOperationSettings(supabase, organizationProfile.id)
        ]);
        setLabelForm({ workers: orgLabels.workers, holidayLabel: orgLabels.holidayLabel });
        setOperationForm({
          closedWeekdays: orgOperationSettings.closedWeekdays,
          closeOnNationalHolidays: orgOperationSettings.closeOnNationalHolidays
        });
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "組織メンバーを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function saveOrganization(event: FormEvent) {
    event.preventDefault();
    if (!organization) return;
    setSavingOrganization(true);
    setMessage("");
    setError("");
    setOrganizationNotice("");
    try {
      await updateOperationsOrganizationProfile(supabase, {
        id: organization.id,
        name: organizationForm.name,
        email: organizationForm.email,
        phone: organizationForm.phone,
        address: organizationForm.address,
        shiftSubmissionDeadlineDay: Number(organizationForm.shiftSubmissionDeadlineDay),
        otherDeadlineDay: organizationForm.otherDeadlineDay ? Number(organizationForm.otherDeadlineDay) : null,
        paymentDay: organizationForm.paymentDay ? Number(organizationForm.paymentDay) : null
      });
      setOrganizationNotice("企業情報と締め日を保存しました。");
      await reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "企業情報を保存できませんでした。");
    } finally {
      setSavingOrganization(false);
    }
  }

  async function saveLabels(event: FormEvent) {
    event.preventDefault();
    if (!organization) return;
    setSavingLabels(true);
    setMessage("");
    setError("");
    setLabelsNotice("");
    try {
      await updateTeamWorksLabels(supabase, organization.id, {
        workers: labelForm.workers.trim() || DEFAULT_LABELS.workers,
        holidayLabel: labelForm.holidayLabel.trim() || DEFAULT_LABELS.holidayLabel
      });
      setLabelsNotice("表示ラベル設定を保存しました。");
      await reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "表示ラベル設定を保存できませんでした。");
    } finally {
      setSavingLabels(false);
    }
  }

  function toggleClosedWeekday(day: number) {
    setOperationForm((previous) => ({
      ...previous,
      closedWeekdays: previous.closedWeekdays.includes(day)
        ? previous.closedWeekdays.filter((value) => value !== day)
        : [...previous.closedWeekdays, day].sort((a, b) => a - b)
    }));
  }

  async function saveOperationSettings(event: FormEvent) {
    event.preventDefault();
    if (!organization) return;
    setSavingOperationSettings(true);
    setMessage("");
    setError("");
    setOperationNotice("");
    try {
      await updateOrganizationOperationSettings(supabase, organization.id, {
        closedWeekdays: operationForm.closedWeekdays,
        closeOnNationalHolidays: operationForm.closeOnNationalHolidays
      });
      setOperationNotice("休日設定を保存しました。");
      await reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "休日設定を保存できませんでした。");
    } finally {
      setSavingOperationSettings(false);
    }
  }

  async function createInvite(event: FormEvent) {
    event.preventDefault();
    setInviting(true);
    setMessage("");
    setError("");
    try {
      const invite = await createOperationsStaffInvite(supabase, inviteEmail);
      const url = new URL(`/apps/team-works/invite/${invite.id}`, window.location.origin);
      url.searchParams.set("organization", invite.organizationId);
      url.searchParams.set("role", invite.role);
      setInviteUrl(url.toString());
      setMessage("本部メンバーの招待リンクを作成しました。");
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "招待リンクを作成できませんでした。");
    } finally {
      setInviting(false);
    }
  }

  async function archive(member: OperationsOrganizationMemberEntry) {
    if (!window.confirm(`${member.displayName}さん（${roleLabel(member.role, labels)}）をアーカイブしますか？\n過去の予定・報告・支払などの記録は残ります。同じメールアドレスで新しい招待を受け直せるようになります。`)) return;
    setBusyId(member.id);
    setMessage("");
    setError("");
    try {
      await archiveOperationsOrganizationMember(supabase, member.id);
      setMessage(`${member.displayName}さんをアーカイブしました。`);
      await reload();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "アーカイブできませんでした。");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <TeamWorksOperationsShell title="企業設定" subtitle="組織メンバーの管理">
      <div className="space-y-5">
        <MikkeSection title="企業情報" tone="editorial">
          <form onSubmit={saveOrganization} className="grid gap-3 sm:grid-cols-2">
            <TeamWorksProjectField label="企業名" required><input value={organizationForm.name} onChange={(event) => setOrganizationForm({ ...organizationForm, name: event.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
            <TeamWorksProjectField label="代表メール"><input type="email" value={organizationForm.email} onChange={(event) => setOrganizationForm({ ...organizationForm, email: event.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
            <TeamWorksProjectField label="電話番号"><input value={organizationForm.phone} onChange={(event) => setOrganizationForm({ ...organizationForm, phone: event.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
            <TeamWorksProjectField label="住所"><input value={organizationForm.address} onChange={(event) => setOrganizationForm({ ...organizationForm, address: event.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
            <div className="sm:col-span-2 mt-2 rounded-2xl border border-[#ffd370] bg-[#ffd370]/20 p-4">
              <p className="mb-3 text-sm font-extrabold text-[var(--mikke-primary)]">運用日の設定</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <TeamWorksProjectField label="シフト提出締め日" required><input type="number" min={1} max={31} value={organizationForm.shiftSubmissionDeadlineDay} onChange={(event) => setOrganizationForm({ ...organizationForm, shiftSubmissionDeadlineDay: event.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
                <TeamWorksProjectField label="その他の締め日"><input type="number" min={1} max={31} value={organizationForm.otherDeadlineDay} onChange={(event) => setOrganizationForm({ ...organizationForm, otherDeadlineDay: event.target.value })} placeholder="未設定" className={teamWorksProjectInputClass} /></TeamWorksProjectField>
                <TeamWorksProjectField label="支払日"><input type="number" min={1} max={31} value={organizationForm.paymentDay} onChange={(event) => setOrganizationForm({ ...organizationForm, paymentDay: event.target.value })} placeholder="未設定" className={teamWorksProjectInputClass} /></TeamWorksProjectField>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-[var(--mikke-muted)]">月末より後の日付を設定した月は、その月の最終日として案内します。</p>
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <button disabled={savingOrganization || !organization} className="rounded-xl bg-[var(--tw-action)] px-4 py-2.5 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">{savingOrganization ? "保存中…" : "企業情報を保存"}</button>
              {organizationNotice ? <span role="status" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--tw-on-tint)]"><CheckCircle2 size={15} />{organizationNotice}</span> : null}
              {error ? <span role="alert" className="text-xs font-bold text-[var(--tw-action)]">{error}</span> : null}
            </div>
          </form>
        </MikkeSection>

        <MikkeSection title="表示ラベル設定" tone="editorial">
          <p className="-mt-2 mb-3 text-xs leading-6 text-[var(--mikke-muted)]">
            呼び名を事業に合わせて変えられます。変えなければ今まで通りの表示のままです。
          </p>
          <form onSubmit={saveLabels} className="grid gap-3 sm:grid-cols-2">
            <TeamWorksProjectField label="働く人の呼び名" required>
              <input value={labelForm.workers} onChange={(event) => setLabelForm({ ...labelForm, workers: event.target.value })} className={teamWorksProjectInputClass} />
              <span className="mt-1 block text-[11px] leading-5 font-semibold text-[var(--mikke-muted)]">例）パートナー、スタッフ、講師、キャスト。「◯◯管理」「◯◯希望シフト」などに反映されます。</span>
            </TeamWorksProjectField>
            <TeamWorksProjectField label="休みの日の呼び名" required>
              <input value={labelForm.holidayLabel} onChange={(event) => setLabelForm({ ...labelForm, holidayLabel: event.target.value })} className={teamWorksProjectInputClass} />
              <span className="mt-1 block text-[11px] leading-5 font-semibold text-[var(--mikke-muted)]">例）休校、定休日、休業日。カレンダーの休みの日の表示に反映されます。</span>
            </TeamWorksProjectField>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <button disabled={savingLabels || !organization} className="rounded-xl bg-[var(--tw-action)] px-4 py-2.5 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">{savingLabels ? "保存中…" : "表示ラベル設定を保存"}</button>
              {labelsNotice ? <span role="status" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--tw-on-tint)]"><CheckCircle2 size={15} />{labelsNotice}</span> : null}
            </div>
          </form>
        </MikkeSection>

        <MikkeSection title="休日設定" tone="editorial">
          <p className="-mt-2 mb-3 text-xs leading-6 text-[var(--mikke-muted)]">
            休みの日はカレンダーに色付きで表示され、コマ（レッスン）の登録ができなくなります。校舎・店舗ごとに休みが違う場合は、各プロジェクトの「プロジェクト設定」タブでこの組織設定を上書きできます。
          </p>
          <form onSubmit={saveOperationSettings} className="space-y-4">
            <div>
              <span className="mb-2 block text-xs font-bold">定休の曜日</span>
              <div className="flex flex-wrap gap-2">
                {weekdayChipLabels.map((label, day) => {
                  const closed = operationForm.closedWeekdays.includes(day);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleClosedWeekday(day)}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                        closed
                          ? "border-[var(--mikke-pink)] bg-[var(--mikke-pink)] text-[var(--tw-on-tint)]"
                          : "border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={operationForm.closeOnNationalHolidays}
                onChange={(event) => setOperationForm({ ...operationForm, closeOnNationalHolidays: event.target.checked })}
              />
              祝日を休みにする
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button disabled={savingOperationSettings || !organization} className="rounded-xl bg-[var(--tw-action)] px-4 py-2.5 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">{savingOperationSettings ? "保存中…" : "休日設定を保存"}</button>
              {operationNotice ? <span role="status" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--tw-on-tint)]"><CheckCircle2 size={15} />{operationNotice}</span> : null}
            </div>
          </form>
        </MikkeSection>

        <MikkeSection title="ポータル表示設定" tone="editorial">
          <p className="-mt-2 text-xs leading-6 text-[var(--mikke-muted)]">
            運営型は、プロジェクトごとの「ポータル設定」タブで出す項目を細かく切り替えられます。納品型は今は「クライアント公開」のON/OFFのみです。設定はプロジェクトを開いて行います。
          </p>
          <Link href="/apps/team-works/projects" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--mikke-primary)]">
            プロジェクト管理を開く ›
          </Link>
        </MikkeSection>

        <MikkeSection title="本部メンバーを招待" tone="editorial">
          <p className="-mt-2 mb-3 text-xs leading-6 text-[var(--mikke-muted)]">この本部のホーム・プロジェクト・名簿を管理できるマネージャーを招待します。</p>
          <form onSubmit={createInvite} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <TeamWorksProjectField label="メールアドレス" required><input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
            <button disabled={inviting || !inviteEmail.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--tw-action)] px-4 py-2.5 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]"><UserPlus size={15} />{inviting ? "作成中…" : "招待リンクを作成"}</button>
          </form>
          {inviteUrl ? <div className="mt-3 flex gap-2"><input readOnly value={inviteUrl} className={teamWorksProjectInputClass} /><button type="button" onClick={() => void navigator.clipboard.writeText(inviteUrl)} className="shrink-0 rounded-xl border border-[var(--mikke-line)] px-3 text-xs font-bold"><Clipboard size={15} /></button></div> : null}
        </MikkeSection>

        <MikkeSection title="組織メンバー" tone="editorial">
          <p className="-mt-2 text-xs leading-6 text-[var(--mikke-muted)]">
            ここに表示されるのは現在アクティブなメンバーです。アーカイブすると本部・各ポータルへのアクセスを止めてこの一覧から隠しますが、過去の予定・報告・支払記録は保持します。同じメールアドレスで再招待できます。オーナーはアーカイブできません。
          </p>
          {message ? <p role="status" className="mt-3 text-xs font-bold text-[var(--mikke-primary)]">{message}</p> : null}
          {error ? <p role="alert" className="mt-3 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}
          {loading ? (
            <p className="mt-4 text-sm font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>
          ) : members.length === 0 ? (
            <MikkeEmptyState title="組織メンバーはまだいません" />
          ) : (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {members.map((member) => (
                <article key={member.id} className="rounded-xl border border-[var(--mikke-line)] bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--mikke-green)] text-[#1b1b1f]">
                      <UserCog size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{member.displayName}</p>
                      {member.email ? (
                        <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-semibold text-[var(--mikke-muted)]">
                          <Mail size={13} /> {member.email}
                        </p>
                      ) : null}
                      <span className="mt-2 inline-block rounded-full bg-[var(--mikke-primary-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--mikke-primary)]">
                        {roleLabel(member.role, labels)}
                      </span>
                      <span className="ml-2 mt-2 inline-block rounded-full bg-[var(--mikke-green)] px-2.5 py-1 text-[10px] font-bold">アクティブ</span>
                    </div>
                    {member.role === "owner" ? null : (
                      <button
                        type="button"
                        disabled={busyId === member.id}
                        onClick={() => void archive(member)}
                        className="shrink-0 rounded-lg border border-[var(--tw-action)] px-2 py-1 text-[11px] font-bold text-[var(--tw-action)] disabled:opacity-50"
                      >
                        {busyId === member.id ? <LoaderCircle size={13} className="animate-spin" /> : "アーカイブ"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </MikkeSection>
      </div>
    </TeamWorksOperationsShell>
  );
}

export default function TeamWorksSettingsPage() {
  return (
    <AuthGate>
      <TeamWorksSettingsContent />
    </AuthGate>
  );
}
