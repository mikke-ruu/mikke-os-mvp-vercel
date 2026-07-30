"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileCheck2,
  FileText,
  Info,
  ListChecks,
  Package,
  Plus,
  Save,
  Settings2,
  UsersRound
} from "lucide-react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeListRow } from "@/components/mikkeos/MikkeListRow";
import { supabase } from "@/lib/supabase/client";
import {
  loadOperationsClientDirectory,
  loadOperationsPartnerDirectory,
  type OperationsClientDirectoryEntry,
  type OperationsPartnerDirectoryEntry
} from "@/lib/team-works-operations-project";
import {
  addDeliveryProjectMember,
  autoScheduleDeliveryTasks,
  createDeliveryTask,
  deliveryTaskOwnerRoleLabels,
  emptyDeliveryTaskInstruction,
  deliveryTaskStatusLabels,
  deliveryTaskSubmissionTypeLabels,
  fetchDeliveryProjectPendingInvites,
  loadDeliveryProjectDetail,
  resolveMyDeliveryProjectMembership,
  revokeDeliveryProjectInvite,
  updateDeliveryProjectDueOn,
  updateDeliveryProjectSettings,
  updateDeliveryTask,
  type DeliveryPendingInvite,
  type DeliveryProjectDetail,
  type DeliveryProjectMember,
  type DeliveryTask,
  type DeliveryTaskInstruction,
  type DeliveryTaskOwnerRole,
  type DeliveryTaskStatus,
  type DeliveryTaskSubmissionType
} from "@/lib/team-works-delivery";
import {
  archiveTaskForm,
  createTaskForm,
  fetchTaskForms,
  updateTaskForm,
  type DeliveryFormInputActor,
  type DeliveryProjectForm
} from "@/lib/team-works-delivery-forms";
import { buildDeliveryCalendarItems, TeamWorksDeliveryCalendar } from "./TeamWorksDeliveryCalendar";
import { TeamWorksDeliveryDeliverableAdminPanel } from "./TeamWorksDeliveryDeliverableAdminPanel";
import { TeamWorksDeliveryStaffPendingSummary } from "./TeamWorksDeliveryStaffPendingSummary";
import { TeamWorksProjectArchivePanel } from "./TeamWorksProjectArchivePanel";
import { TeamWorksProjectFormBuilder, type DeliveryFormPatch } from "./TeamWorksProjectFormBuilder";
import { TeamWorksProjectFormSubmissionsReview } from "./TeamWorksProjectFormSubmissionsReview";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "./TeamWorksProjectsShell";
import { TeamWorksTaskInstructionEditor, toTaskInstruction } from "./TeamWorksTaskInstructionEditor";

const taskStatuses = Object.keys(deliveryTaskStatusLabels) as DeliveryTaskStatus[];
const ownerRoles = Object.keys(deliveryTaskOwnerRoleLabels) as DeliveryTaskOwnerRole[];
const submissionTypes = Object.keys(deliveryTaskSubmissionTypeLabels) as DeliveryTaskSubmissionType[];

type DeliveryProjectTab = "overview" | "tasks" | "schedule" | "deliverables" | "members" | "settings";

function buildDeliveryTabs(): { id: DeliveryProjectTab; label: string }[] {
  return [
    { id: "overview", label: "概要" },
    { id: "tasks", label: "工程" },
    { id: "schedule", label: "スケジュール" },
    { id: "deliverables", label: "成果物" },
    { id: "members", label: "メンバー" },
    { id: "settings", label: "プロジェクト設定" }
  ];
}

// Supabase接続版の納品型プロジェクト詳細。外枠(戻る矢印・タイトル・種別バッジ・
// 下線タブ)は運営型(TeamWorksOperationsProjectDetail)と同じマークアップ・
// classNameを使い、本部側の見た目を統一している。タブの中身は納品型の仕事に
// 必要なものだけを独自に決めており、運営型のタブ構成(名簿/報告/マニュアル等)は
// 真似ていない(運営型はアリサ案件固有で将来仕様が変わる見込みのため)。
export function TeamWorksDeliveryProjectDetail({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tabs = buildDeliveryTabs();
  const [activeTab, setActiveTab] = useState<DeliveryProjectTab>(
    tabs.some((tab) => tab.id === requestedTab) ? (requestedTab as DeliveryProjectTab) : "overview"
  );
  const [detail, setDetail] = useState<DeliveryProjectDetail | null | undefined>(undefined);
  const [myMembership, setMyMembership] = useState<DeliveryProjectMember | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextDetail, nextMembership] = await Promise.all([
        loadDeliveryProjectDetail(supabase, projectId),
        resolveMyDeliveryProjectMembership(supabase, projectId)
      ]);
      setDetail(nextDetail);
      setMyMembership(nextMembership);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "プロジェクトを読み込めませんでした。");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <MikkeEmptyState title="読み込みに失敗しました" helper={error} />;
  if (detail === undefined) return <p className="text-sm font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>;
  if (detail === null) return <MikkeEmptyState title="このプロジェクトは見つかりませんでした" />;

  const myMemberId = myMembership?.organizationMemberId ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/apps/team-works/projects"
          aria-label="プロジェクト管理へ戻る"
          className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--mikke-line)] bg-white text-[var(--mikke-text)]"
        >
          <ArrowLeft size={17} />
        </Link>
        <h1 className="text-xl font-extrabold text-[var(--mikke-text)]">{detail.project.title}</h1>
        <span className="rounded-full bg-[var(--mikke-yellow)] px-2.5 py-1 text-[11px] font-bold text-[var(--tw-on-tint)]">
          納品型
        </span>
      </div>

      <nav
        aria-label={`${detail.project.title}のメニュー`}
        className="-mx-4 overflow-x-auto border-b border-[var(--mikke-line)] px-4"
      >
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-3 py-2.5 text-xs font-bold transition ${
                activeTab === tab.id
                  ? "border-[var(--mikke-accent)] text-[var(--mikke-primary)]"
                  : "border-transparent text-[var(--mikke-muted)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {activeTab === "overview" ? <OverviewTab detail={detail} onSelectTab={setActiveTab} /> : null}
      {activeTab === "tasks" ? <TaskListSection detail={detail} myMemberId={myMemberId} onReload={load} /> : null}
      {activeTab === "schedule" ? <ScheduleTab detail={detail} onReload={load} /> : null}
      {activeTab === "deliverables" ? <DeliverablesTab detail={detail} myMemberId={myMemberId} /> : null}
      {activeTab === "members" ? <MembersTab detail={detail} onReload={load} /> : null}
      {activeTab === "settings" ? <SettingsTab detail={detail} onReload={load} /> : null}
    </div>
  );
}

function TabIntro({
  icon: Icon,
  title,
  description
}: {
  icon: typeof CalendarDays;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl bg-[var(--mikke-surface-soft)] p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--mikke-yellow)] text-[var(--tw-on-tint)]">
        <Icon size={19} />
      </span>
      <span>
        <span className="block text-sm font-extrabold">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-[var(--mikke-muted)]">{description}</span>
      </span>
    </div>
  );
}

function OverviewTab({ detail, onSelectTab }: { detail: DeliveryProjectDetail; onSelectTab: (tab: DeliveryProjectTab) => void }) {
  const { tasks, members } = detail;
  const completedCount = tasks.filter((task) => task.status === "completed").length;
  const upcoming = tasks
    .flatMap((task) => {
      const items: { taskId: string; title: string; date: string; kind: "提出期日" | "完了期日" }[] = [];
      if (task.submitDueOn) items.push({ taskId: task.id, title: task.title, date: task.submitDueOn, kind: "提出期日" });
      if (task.dueOn) items.push({ taskId: task.id, title: task.title, date: task.dueOn, kind: "完了期日" });
      return items;
    })
    .filter((item) => item.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <TabIntro icon={Info} title="概要" description="工程の進み具合と、対応が必要なことをまとめて確認します。" />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
          <p className="text-xs font-bold text-[var(--mikke-muted)]">進捗</p>
          <p className="mt-1 text-lg font-extrabold">{tasks.length}工程中 {completedCount}件完了</p>
        </div>
        <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
          <p className="text-xs font-bold text-[var(--mikke-muted)]">納期</p>
          <p className="mt-1 text-lg font-extrabold">{detail.project.dueOn ?? "未設定"}</p>
        </div>
        <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
          <p className="text-xs font-bold text-[var(--mikke-muted)]">参加メンバー</p>
          <p className="mt-1 text-lg font-extrabold">{members.length}名</p>
        </div>
      </div>

      <TeamWorksDeliveryStaffPendingSummary detail={detail} />

      <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-sm font-extrabold">次の期日</p>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">今後の期日はまだ設定されていません。</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {upcoming.map((item, index) => (
              <button
                key={`${item.taskId}-${item.kind}-${index}`}
                type="button"
                onClick={() => onSelectTab("tasks")}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold hover:bg-[var(--mikke-surface-soft)]"
              >
                <CalendarDays size={13} className="shrink-0 text-[var(--mikke-muted)]" />
                <span className="text-[var(--mikke-muted)]">{item.date}</span>
                <span>{item.title}</span>
                <span className="text-[var(--mikke-muted)]">・{item.kind}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScheduleTab({ detail, onReload }: { detail: DeliveryProjectDetail; onReload: () => Promise<void> }) {
  const { project, tasks } = detail;
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const calendarItems = buildDeliveryCalendarItems(tasks);
  const selectedDayTasks = selectedDay ? tasks.filter((task) => task.dueOn === selectedDay || task.submitDueOn === selectedDay) : [];

  return (
    <div className="space-y-5">
      <TabIntro icon={CalendarDays} title="スケジュール" description="納期から逆算して各工程の期日を配置し、カレンダーで確認します。" />
      <ProjectDueOnEditor projectId={project.id} dueOn={project.dueOn} tasks={tasks} onReload={onReload} />
      <TeamWorksDeliveryCalendar items={calendarItems} onSelectDay={setSelectedDay} />
      {selectedDay ? (
        <div className="rounded-xl border border-[var(--mikke-line)] bg-white p-3">
          <p className="text-xs font-extrabold">{selectedDay} のタスク</p>
          {selectedDayTasks.length === 0 ? (
            <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">この日のタスクはありません。</p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {selectedDayTasks.map((task) => (
                <p key={task.id} className="text-xs font-semibold">
                  {task.title}・{deliveryTaskStatusLabels[task.status]}
                  {task.submitDueOn === selectedDay ? "・提出期日" : ""}
                  {task.dueOn === selectedDay ? "・完了期日" : ""}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// 工程をまたいだ提出物をここでまとめて確認できるようにする(工程を1つずつ
// 開かなくても、確認待ちの成果物にすぐたどり着けるようにするため)。
function DeliverablesTab({ detail, myMemberId }: { detail: DeliveryProjectDetail; myMemberId: string | null }) {
  const deliverableTasks = detail.tasks.filter((task) => task.submissionType === "file" || task.submissionType === "url");

  return (
    <div className="space-y-5">
      <TabIntro icon={Package} title="成果物" description="工程ごとの提出物をまとめて確認・承認・差し戻しできます。" />
      {deliverableTasks.length === 0 ? (
        <MikkeEmptyState title="成果物を伴う工程はまだありません" helper="「工程」タブで、提出物を「ファイル」または「URL」に設定してください。" />
      ) : (
        <div className="space-y-4">
          {deliverableTasks.map((task) => (
            <div key={task.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3">
              <p className="mb-2 text-sm font-extrabold">{task.title}</p>
              <TeamWorksDeliveryDeliverableAdminPanel task={task} myMemberId={myMemberId} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// プロジェクト作成後もメンバーを追加できるようにする。名簿の相手がまだ
// ポータルにログインしていない場合は招待を送り(黙って無視しない)、
// 「招待中」に並べる。相手がログインすると自動で「参加中」へ移る。
function MembersTab({ detail, onReload }: { detail: DeliveryProjectDetail; onReload: () => Promise<void> }) {
  const { members } = detail;
  const [invites, setInvites] = useState<DeliveryPendingInvite[] | undefined>(undefined);
  const [partners, setPartners] = useState<OperationsPartnerDirectoryEntry[]>([]);
  const [clients, setClients] = useState<OperationsClientDirectoryEntry[]>([]);
  const [selectedDirectoryValue, setSelectedDirectoryValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadExtras = useCallback(async () => {
    try {
      const [inviteRows, partnerRows, clientRows] = await Promise.all([
        fetchDeliveryProjectPendingInvites(supabase, detail.project.id),
        loadOperationsPartnerDirectory(supabase),
        loadOperationsClientDirectory(supabase)
      ]);
      setInvites(inviteRows);
      setPartners(partnerRows.filter((partner) => partner.status !== "archived"));
      setClients(clientRows.filter((client) => client.status !== "archived"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "読み込めませんでした。");
    }
  }, [detail.project.id]);

  useEffect(() => {
    void loadExtras();
  }, [loadExtras]);

  async function addMember() {
    if (!selectedDirectoryValue) return;
    const [table, directoryId] = selectedDirectoryValue.split(":");
    const directoryTable = table === "partner" ? "team_works_partners" : "team_works_clients";
    const projectRole = table === "partner" ? "worker" : "client";
    setAdding(true);
    setError("");
    setMessage("");
    try {
      const result = await addDeliveryProjectMember(supabase, { projectId: detail.project.id, directoryTable, directoryId, projectRole });
      if (result.status === "assigned") {
        setMessage(`${result.displayName}さんをメンバーに追加しました。`);
      } else if (result.status === "invited") {
        setMessage(`${result.displayName}さんに参加のお願いを送りました。相手がログインすると自動でメンバーになります。`);
      } else {
        setError("名簿から選択した相手が見つかりませんでした。");
      }
      setSelectedDirectoryValue("");
      await Promise.all([onReload(), loadExtras()]);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "追加できませんでした。");
    } finally {
      setAdding(false);
    }
  }

  async function revoke(inviteId: string) {
    setBusyInviteId(inviteId);
    setError("");
    try {
      await revokeDeliveryProjectInvite(supabase, inviteId);
      await loadExtras();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "取り消せませんでした。");
    } finally {
      setBusyInviteId(null);
    }
  }

  const placeholderLabelCounts = new Map<string, number>();
  for (const task of detail.tasks) {
    if (task.assigneeLabel) placeholderLabelCounts.set(task.assigneeLabel, (placeholderLabelCounts.get(task.assigneeLabel) ?? 0) + 1);
  }

  return (
    <div className="space-y-5">
      <TabIntro icon={UsersRound} title="メンバー" description="参加中・招待中・仮の担当名をまとめて確認します。" />

      <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-sm font-extrabold">参加中</p>
        {members.length === 0 ? (
          <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">参加メンバーはまだいません。</p>
        ) : (
          <div className="mt-2 space-y-2">
            {members.map((member) => (
              <MikkeListRow key={member.organizationMemberId} title={member.displayName} label={projectRoleLabel(member.projectRole)} icon={UsersRound} />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-sm font-extrabold">名簿から追加</p>
        <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">
          まだポータルにログインしていない相手を選んだ場合は、参加のお願い(招待)を送ります。
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <select value={selectedDirectoryValue} onChange={(event) => setSelectedDirectoryValue(event.target.value)} className={teamWorksProjectInputClass}>
            <option value="">選択してください</option>
            <optgroup label="担当メンバー(パートナー名簿)">
              {partners.map((partner) => <option key={partner.id} value={`partner:${partner.id}`}>{partner.displayName}</option>)}
            </optgroup>
            <optgroup label="クライアント(クライアント名簿)">
              {clients.map((client) => <option key={client.id} value={`client:${client.id}`}>{client.displayName}</option>)}
            </optgroup>
          </select>
          <button
            type="button"
            onClick={() => void addMember()}
            disabled={!selectedDirectoryValue || adding}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]"
          >
            <Plus size={14} /> 追加
          </button>
        </div>
        {error ? <p role="alert" className="mt-2 rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}
        {message ? <p className="mt-2 text-xs font-bold text-[var(--tw-done)]">{message}</p> : null}
      </div>

      <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-sm font-extrabold">招待中</p>
        {invites === undefined ? (
          <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>
        ) : invites.length === 0 ? (
          <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">招待中の相手はいません。</p>
        ) : (
          <div className="mt-2 space-y-2">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center gap-3 rounded-lg border border-[var(--mikke-line)] p-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{invite.email}</span>
                  <span className="text-xs font-semibold text-[var(--mikke-muted)]">
                    {invite.role === "worker" ? "担当メンバー" : "クライアント"}・招待中(期限 {invite.expiresAt.slice(0, 10)})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void revoke(invite.id)}
                  disabled={busyInviteId === invite.id}
                  className="shrink-0 rounded-lg border border-[var(--mikke-line)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-muted)] disabled:opacity-40"
                >
                  招待を取り消す
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {placeholderLabelCounts.size > 0 ? (
        <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
          <p className="text-sm font-extrabold">仮の担当名</p>
          <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">
            実メンバーが決まったら、上の「名簿から追加」でメンバーに加えたあと、「工程」タブでその工程の担当を差し替えてください。
          </p>
          <ul className="mt-2 space-y-1">
            {[...placeholderLabelCounts.entries()].map(([label, count]) => (
              <li key={label} className="text-xs font-semibold">{label}・{count}件の工程</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SettingsTab({ detail, onReload }: { detail: DeliveryProjectDetail; onReload: () => Promise<void> }) {
  const [title, setTitle] = useState(detail.project.title);
  const [clientVisible, setClientVisible] = useState(detail.project.clientVisible);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateDeliveryProjectSettings(supabase, detail.project.id, { title: title.trim(), clientVisible });
      setMessage("保存しました。");
      await onReload();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <TabIntro icon={Settings2} title="プロジェクト設定" description="プロジェクト名や、クライアントへの公開範囲を管理します。" />
      <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
        <TeamWorksProjectField label="プロジェクト名" required>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className={teamWorksProjectInputClass} required />
        </TeamWorksProjectField>
        <label className="flex items-center gap-2 text-xs font-bold">
          <input type="checkbox" checked={clientVisible} onChange={(event) => setClientVisible(event.target.checked)} />
          クライアントにプロジェクト全体を公開する
        </label>
        {error ? <p role="alert" className="rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}
        {message ? <p className="text-xs font-bold text-[var(--tw-done)]">{message}</p> : null}
        <button type="submit" disabled={saving || !title.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--tw-action)] px-4 py-2.5 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">
          <Save size={15} /> 保存
        </button>
      </form>

      <TeamWorksProjectArchivePanel projectId={detail.project.id} projectTitle={detail.project.title} />
    </div>
  );
}

function ProjectDueOnEditor({
  projectId,
  dueOn,
  tasks,
  onReload
}: {
  projectId: string;
  dueOn: string | null;
  tasks: DeliveryTask[];
  onReload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function changeDueOn(nextDueOn: string) {
    setBusy(true);
    setError("");
    try {
      await updateDeliveryProjectDueOn(supabase, projectId, nextDueOn || null);
      await onReload();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  async function autoSchedule() {
    if (!dueOn || tasks.length === 0) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await autoScheduleDeliveryTasks(supabase, { tasks, dueOn });
      setMessage("納期から逆算して各工程の期日を配置しました。");
      await onReload();
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "配置できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
      <TeamWorksProjectField label="納期" helper="逆算配置の起点になります">
        <input type="date" defaultValue={dueOn ?? ""} disabled={busy} onChange={(event) => void changeDueOn(event.target.value)} className={teamWorksProjectInputClass} />
      </TeamWorksProjectField>
      <button
        type="button"
        onClick={() => void autoSchedule()}
        disabled={busy || !dueOn || tasks.length === 0}
        className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-xs font-bold disabled:opacity-40"
      >
        納期から逆算して配置
      </button>
      {error ? <p role="alert" className="text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}
      {message ? <p className="text-xs font-bold text-[var(--tw-done)]">{message}</p> : null}
    </div>
  );
}

function projectRoleLabel(role: "owner" | "manager" | "client" | "worker"): string {
  if (role === "owner") return "オーナー";
  if (role === "manager") return "マネージャー";
  if (role === "client") return "クライアント";
  return "担当メンバー";
}

type NewTaskForm = {
  title: string;
  dueOn: string;
  submitDueOn: string;
  standardDays: string;
  assigneeMemberId: string;
  assigneeLabel: string;
  clientVisible: boolean;
  ownerRole: DeliveryTaskOwnerRole | "";
  submissionType: DeliveryTaskSubmissionType;
  needsInternalReview: boolean;
  needsClientReview: boolean;
  instruction: DeliveryTaskInstruction;
};

const emptyNewTaskForm: NewTaskForm = {
  title: "",
  dueOn: "",
  submitDueOn: "",
  standardDays: "",
  assigneeMemberId: "",
  assigneeLabel: "",
  clientVisible: false,
  ownerRole: "",
  submissionType: "none",
  needsInternalReview: false,
  needsClientReview: false,
  instruction: emptyDeliveryTaskInstruction
};

function TaskListSection({ detail, myMemberId, onReload }: { detail: DeliveryProjectDetail; myMemberId: string | null; onReload: () => Promise<void> }) {
  const [form, setForm] = useState<NewTaskForm>(emptyNewTaskForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [instructionOpen, setInstructionOpen] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createDeliveryTask(supabase, {
        projectId: detail.project.id,
        title: form.title.trim(),
        assigneeMemberId: form.assigneeMemberId || null,
        assigneeLabel: form.assigneeMemberId ? null : form.assigneeLabel.trim() || null,
        dueOn: form.dueOn || null,
        submitDueOn: form.submitDueOn || null,
        standardDays: form.standardDays ? Number(form.standardDays) : null,
        clientVisible: form.clientVisible,
        ownerRole: form.ownerRole || null,
        submissionType: form.submissionType,
        needsInternalReview: form.needsInternalReview,
        needsClientReview: form.needsClientReview,
        instruction: {
          ...form.instruction,
          // 追加ボタンで作った未入力の行は保存前に落とす。
          checklist: form.instruction.checklist.map((item) => item.trim()).filter(Boolean),
          outputs: form.instruction.outputs.map((item) => item.trim()).filter(Boolean)
        }
      });
      setForm(emptyNewTaskForm);
      setInstructionOpen(false);
      await onReload();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "タスクを追加できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <TabIntro icon={ListChecks} title="工程" description="工程を追加し、担当・提出物・確認者・期日を設定します。" />
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <TeamWorksProjectField label="工程名" required className="md:col-span-2">
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例：テキスト・ディプロマ作成" className={teamWorksProjectInputClass} required />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="誰が作業するか">
            <select value={form.ownerRole} onChange={(event) => setForm({ ...form, ownerRole: event.target.value as DeliveryTaskOwnerRole | "" })} className={teamWorksProjectInputClass}>
              <option value="">未設定</option>
              {ownerRoles.map((role) => <option key={role} value={role}>{deliveryTaskOwnerRoleLabels[role]}</option>)}
            </select>
          </TeamWorksProjectField>
          <TeamWorksProjectField label="担当メンバー" helper="ここに出るのは参加中のメンバーだけです。招待中でまだログインしていない相手や、名簿にまだいない相手は「仮の担当名」を使ってください(「メンバー」タブで招待できます)。">
            <select value={form.assigneeMemberId} onChange={(event) => setForm({ ...form, assigneeMemberId: event.target.value })} className={teamWorksProjectInputClass}>
              <option value="">未割当</option>
              {detail.members.map((member) => <option key={member.organizationMemberId} value={member.organizationMemberId}>{member.displayName}</option>)}
            </select>
          </TeamWorksProjectField>
          {!form.assigneeMemberId ? (
            <TeamWorksProjectField label="仮の担当名(任意)" helper="例：ネオン、カメラマン(未定)">
              <input value={form.assigneeLabel} onChange={(event) => setForm({ ...form, assigneeLabel: event.target.value })} className={teamWorksProjectInputClass} />
            </TeamWorksProjectField>
          ) : null}
          <TeamWorksProjectField label="提出期日" helper="担当者がこの日までに提出する">
            <input type="date" value={form.submitDueOn} onChange={(event) => setForm({ ...form, submitDueOn: event.target.value })} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="完了期日" helper="この工程自体が完了する日">
            <input type="date" value={form.dueOn} onChange={(event) => setForm({ ...form, dueOn: event.target.value })} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="何を提出するか">
            <select value={form.submissionType} onChange={(event) => setForm({ ...form, submissionType: event.target.value as DeliveryTaskSubmissionType })} className={teamWorksProjectInputClass}>
              {submissionTypes.map((type) => <option key={type} value={type}>{deliveryTaskSubmissionTypeLabels[type]}</option>)}
            </select>
          </TeamWorksProjectField>
          <TeamWorksProjectField label="標準日数" helper="納期からの逆算配置に使う所要日数(未設定なら3日)">
            <input type="number" min={1} value={form.standardDays} onChange={(event) => setForm({ ...form, standardDays: event.target.value })} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-bold">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.needsInternalReview} onChange={(event) => setForm({ ...form, needsInternalReview: event.target.checked })} />本部の確認が必要</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.needsClientReview} onChange={(event) => setForm({ ...form, needsClientReview: event.target.checked })} />クライアントの確認が必要</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.clientVisible} onChange={(event) => setForm({ ...form, clientVisible: event.target.checked })} />クライアントに表示する</label>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setInstructionOpen((current) => !current)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold"
          >
            <FileText size={14} /> 作業指示を書く(任意)
            {instructionOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {instructionOpen ? (
            <div className="mt-2 rounded-xl border border-[var(--mikke-line)] bg-white p-3">
              <TeamWorksTaskInstructionEditor
                value={form.instruction}
                onChange={(instruction) => setForm({ ...form, instruction })}
              />
            </div>
          ) : null}
        </div>

        <button type="submit" disabled={saving || !form.title.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--tw-action)] px-4 py-2.5 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">
          <Plus size={15} /> 工程を追加
        </button>
      </form>

      {error ? <p role="alert" className="rounded-xl border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}

      <div>
        {detail.tasks.length === 0 ? (
          <MikkeEmptyState title="タスクはまだありません" helper="上のフォームから追加してください。" />
        ) : (
          <div className="divide-y divide-[var(--mikke-line)] overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
            {detail.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                members={detail.members}
                myMemberId={myMemberId}
                expanded={expandedTaskId === task.id}
                onToggle={() => setExpandedTaskId((current) => (current === task.id ? null : task.id))}
                onReload={onReload}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  members,
  myMemberId,
  expanded,
  onToggle,
  onReload
}: {
  task: DeliveryTask;
  members: DeliveryProjectDetail["members"];
  myMemberId: string | null;
  expanded: boolean;
  onToggle: () => void;
  onReload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const assignee = members.find((member) => member.organizationMemberId === task.assigneeMemberId);

  async function apply(patch: Parameters<typeof updateDeliveryTask>[2]) {
    setBusy(true);
    setError("");
    try {
      await updateDeliveryTask(supabase, task.id, patch);
      await onReload();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id={`task-${task.id}`} className="scroll-mt-24 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <ListChecks size={16} className="shrink-0 text-[var(--mikke-muted)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{task.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-[var(--mikke-muted)]">
            {task.submitDueOn ? <span className="inline-flex items-center gap-1"><CalendarDays size={12} />提出{task.submitDueOn}</span> : null}
            {task.dueOn ? <span className="inline-flex items-center gap-1"><CalendarDays size={12} />完了{task.dueOn}</span> : null}
            {!task.submitDueOn && !task.dueOn ? <span>期日未設定</span> : null}
            <span>{assignee ? assignee.displayName : task.assigneeLabel || "未割当"}</span>
            {task.ownerRole ? <span className="rounded-full border border-[var(--mikke-line)] px-1.5 py-0.5">{deliveryTaskOwnerRoleLabels[task.ownerRole]}</span> : null}
            {task.submissionType !== "none" ? <span className="rounded-full border border-[var(--mikke-line)] px-1.5 py-0.5">{deliveryTaskSubmissionTypeLabels[task.submissionType]}</span> : null}
            {task.clientVisible ? <span>・クライアント公開</span> : null}
          </p>
        </div>
        <select
          value={task.status}
          disabled={busy}
          onChange={(event) => void apply({ status: event.target.value as DeliveryTaskStatus })}
          className="shrink-0 rounded-lg border border-[var(--mikke-line)] px-2 py-1.5 text-xs font-bold"
        >
          {taskStatuses.map((status) => <option key={status} value={status}>{deliveryTaskStatusLabels[status]}</option>)}
        </select>
        <button type="button" onClick={onToggle} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--mikke-line)] text-[var(--mikke-muted)]">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {error ? <p role="alert" className="mt-2 rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}

      {expanded ? (
        <div className="mt-3 grid gap-3 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3 md:grid-cols-2">
          <TeamWorksProjectField label="誰が作業するか">
            <select defaultValue={task.ownerRole ?? ""} disabled={busy} onChange={(event) => void apply({ ownerRole: (event.target.value || null) as DeliveryTaskOwnerRole | null })} className={teamWorksProjectInputClass}>
              <option value="">未設定</option>
              {ownerRoles.map((role) => <option key={role} value={role}>{deliveryTaskOwnerRoleLabels[role]}</option>)}
            </select>
          </TeamWorksProjectField>
          <TeamWorksProjectField label="担当メンバー">
            <select defaultValue={task.assigneeMemberId ?? ""} disabled={busy} onChange={(event) => void apply({ assigneeMemberId: event.target.value || null })} className={teamWorksProjectInputClass}>
              <option value="">未割当</option>
              {members.map((member) => <option key={member.organizationMemberId} value={member.organizationMemberId}>{member.displayName}</option>)}
            </select>
          </TeamWorksProjectField>
          {!task.assigneeMemberId ? (
            <TeamWorksProjectField label="仮の担当名">
              <input defaultValue={task.assigneeLabel ?? ""} disabled={busy} onBlur={(event) => void apply({ assigneeLabel: event.target.value || null })} className={teamWorksProjectInputClass} />
            </TeamWorksProjectField>
          ) : null}
          <TeamWorksProjectField label="提出期日">
            <input type="date" defaultValue={task.submitDueOn ?? ""} disabled={busy} onChange={(event) => void apply({ submitDueOn: event.target.value || null })} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="完了期日">
            <input type="date" defaultValue={task.dueOn ?? ""} disabled={busy} onChange={(event) => void apply({ dueOn: event.target.value || null })} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="何を提出するか">
            <select defaultValue={task.submissionType} disabled={busy} onChange={(event) => void apply({ submissionType: event.target.value as DeliveryTaskSubmissionType })} className={teamWorksProjectInputClass}>
              {submissionTypes.map((type) => <option key={type} value={type}>{deliveryTaskSubmissionTypeLabels[type]}</option>)}
            </select>
          </TeamWorksProjectField>
          <TeamWorksProjectField label="標準日数" helper="納期からの逆算配置に使う所要日数(未設定なら3日)">
            <input
              type="number"
              min={1}
              defaultValue={task.standardDays ?? ""}
              disabled={busy}
              onBlur={(event) => void apply({ standardDays: event.target.value ? Number(event.target.value) : null })}
              className={teamWorksProjectInputClass}
            />
          </TeamWorksProjectField>
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold md:col-span-2">
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked={task.needsInternalReview} disabled={busy} onChange={(event) => void apply({ needsInternalReview: event.target.checked })} />本部の確認が必要</label>
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked={task.needsClientReview} disabled={busy} onChange={(event) => void apply({ needsClientReview: event.target.checked })} />クライアントの確認が必要</label>
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked={task.clientVisible} disabled={busy} onChange={(event) => void apply({ clientVisible: event.target.checked })} />クライアントに表示する</label>
          </div>
          <div className="md:col-span-2">
            <TaskInstructionSection task={task} onReload={onReload} />
          </div>
          {task.submissionType === "form" ? (
            <div className="md:col-span-2">
              <TaskFormsPanel task={task} members={members} myMemberId={myMemberId} />
            </div>
          ) : null}
          {task.submissionType === "file" || task.submissionType === "url" ? (
            <div className="md:col-span-2 rounded-xl border border-[var(--mikke-line)] bg-white p-3">
              <p className="flex items-center gap-2 text-xs font-extrabold text-[var(--mikke-muted)]">
                <FileCheck2 size={13} /> この工程の成果物は「成果物」タブでまとめて確認できます。
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// 作業指示は入力量が多いので、他の設定(即保存)と違って
// ローカルで編集してから「作業指示を保存」でまとめて送る。
function TaskInstructionSection({ task, onReload }: { task: DeliveryTask; onReload: () => Promise<void> }) {
  const [instruction, setInstruction] = useState<DeliveryTaskInstruction>(() => toTaskInstruction(task));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(instruction) !== JSON.stringify(toTaskInstruction(task));

  useEffect(() => {
    setInstruction(toTaskInstruction(task));
  }, [task]);

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      // 空行は保存前に落とす(追加ボタンで作った未入力の行が残らないように)。
      await updateDeliveryTask(supabase, task.id, {
        description: instruction.description,
        purpose: instruction.purpose,
        method: instruction.method,
        deliverableNote: instruction.deliverableNote,
        checklist: instruction.checklist.map((item) => item.trim()).filter(Boolean),
        outputs: instruction.outputs.map((item) => item.trim()).filter(Boolean)
      });
      setMessage("作業指示を保存しました。");
      await onReload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--mikke-line)] bg-white p-3">
      <p className="flex items-center gap-2 text-xs font-extrabold">
        <FileText size={14} /> 作業指示
      </p>
      <p className="mt-1 mb-3 text-xs font-semibold text-[var(--mikke-muted)]">
        担当メンバーとクライアントのポータルにそのまま表示されます。
      </p>
      <TeamWorksTaskInstructionEditor value={instruction} onChange={setInstruction} />
      {error ? <p role="alert" className="mt-2 rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]"
        >
          <Save size={14} /> 作業指示を保存
        </button>
        {message && !dirty ? <span className="text-xs font-bold text-[var(--tw-done)]">{message}</span> : null}
      </div>
    </div>
  );
}

function TaskFormsPanel({ task, members, myMemberId }: { task: DeliveryTask; members: DeliveryProjectDetail["members"]; myMemberId: string | null }) {
  const [forms, setForms] = useState<DeliveryProjectForm[] | undefined>(undefined);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setForms(await fetchTaskForms(supabase, task.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "フォームを読み込めませんでした。");
    }
  }, [task.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addForm() {
    setCreating(true);
    setError("");
    try {
      const defaultActor: DeliveryFormInputActor = task.ownerRole === "client" ? "client" : task.ownerRole === "admin" ? "admin" : "worker";
      await createTaskForm(supabase, { projectId: task.projectId, taskId: task.id, name: task.title, inputActor: defaultActor });
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "フォームを作成できませんでした。");
    } finally {
      setCreating(false);
    }
  }

  async function applyPatch(formId: string, patch: DeliveryFormPatch) {
    await updateTaskForm(supabase, formId, patch);
    await load();
  }

  async function remove(formId: string) {
    await archiveTaskForm(supabase, formId);
    await load();
  }

  return (
    <div className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
      <p className="flex items-center gap-2 text-xs font-extrabold">
        <ClipboardList size={14} /> この工程のフォーム
      </p>
      {error ? <p role="alert" className="mt-2 rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}
      {forms === undefined ? (
        <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>
      ) : (
        <div className="mt-2 space-y-2">
          {forms.map((form) => (
            <div key={form.id}>
              <TeamWorksProjectFormBuilder
                form={form}
                onUpdate={(patch) => applyPatch(form.id, patch)}
                onArchive={() => remove(form.id)}
              />
              <TeamWorksProjectFormSubmissionsReview form={form} members={members} myMemberId={myMemberId} />
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => void addForm()} disabled={creating} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold">
        <Plus size={14} /> フォームを追加
      </button>
    </div>
  );
}
