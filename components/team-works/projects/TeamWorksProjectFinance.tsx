"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import {
  readTeamWorksProjectFinanceState,
  saveTeamWorksProjectInvoice,
  saveTeamWorksProjectPayout,
  type TeamWorksProjectFinanceState,
  type TeamWorksProjectInvoiceStatus,
  type TeamWorksProjectPayoutStatus
} from "@/lib/team-works-project-finance";
import type { Project, ProjectTask } from "@/lib/team-works-projects";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "./TeamWorksProjectsShell";

const payoutStatusLabels: Record<TeamWorksProjectPayoutStatus, string> = {
  draft: "下書き",
  approved: "承認済み",
  scheduled: "支払予定",
  paid: "支払済み",
  void: "無効"
};

const invoiceStatusLabels: Record<TeamWorksProjectInvoiceStatus, string> = {
  draft: "下書き",
  issued: "発行済み",
  paid: "入金済み",
  overdue: "期限超過",
  void: "無効"
};

const emptyFinanceState: TeamWorksProjectFinanceState = {
  payoutsEnabled: false,
  invoicesEnabled: false,
  tasks: [],
  members: [],
  payouts: [],
  invoices: []
};

export function TeamWorksProjectFinance({ project, localTasks }: { project: Project; localTasks: ProjectTask[] }) {
  const [financeState, setFinanceState] = useState<TeamWorksProjectFinanceState>(emptyFinanceState);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState<"payout" | "invoice" | "">("");
  const [payoutForm, setPayoutForm] = useState({
    taskSourceId: "",
    payeeMemberId: "",
    amount: "",
    status: "draft" as TeamWorksProjectPayoutStatus,
    dueOn: "",
    note: ""
  });
  const [invoiceForm, setInvoiceForm] = useState({
    taskSourceId: "",
    billedMemberId: "",
    amount: "",
    status: "draft" as TeamWorksProjectInvoiceStatus,
    dueOn: "",
    note: ""
  });

  const workerMembers = useMemo(() => financeState.members.filter((member) => member.role === "worker"), [financeState.members]);
  const clientMembers = useMemo(() => financeState.members.filter((member) => member.role === "client"), [financeState.members]);
  const payoutTotal = financeState.payouts.reduce((sum, record) => record.status === "void" ? sum : sum + record.amount, 0);
  const invoiceTotal = financeState.invoices.reduce((sum, record) => record.status === "void" ? sum : sum + record.amount, 0);

  useEffect(() => { void refreshFinance(); }, [project.id]);

  useEffect(() => {
    setPayoutForm((current) => ({
      ...current,
      taskSourceId: current.taskSourceId || financeState.tasks[0]?.sourceId || "",
      payeeMemberId: current.payeeMemberId || workerMembers[0]?.id || ""
    }));
  }, [financeState.tasks, workerMembers]);

  useEffect(() => {
    setInvoiceForm((current) => ({
      ...current,
      taskSourceId: current.taskSourceId || financeState.tasks[0]?.sourceId || "",
      billedMemberId: current.billedMemberId || clientMembers[0]?.id || ""
    }));
  }, [financeState.tasks, clientMembers]);

  async function refreshFinance() {
    setStatus("loading");
    setErrorMessage("");
    try {
      setFinanceState(await readTeamWorksProjectFinanceState(project.id));
      setStatus("ready");
    } catch (error) {
      setFinanceState(emptyFinanceState);
      setErrorMessage(error instanceof Error ? error.message : "報酬・請求データを読み込めませんでした。");
      setStatus("error");
    }
  }

  async function submitPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payoutForm.taskSourceId || !payoutForm.payeeMemberId) return;
    setSaving("payout");
    setErrorMessage("");
    try {
      await saveTeamWorksProjectPayout({
        projectSourceId: project.id,
        taskSourceId: payoutForm.taskSourceId,
        payeeMemberId: payoutForm.payeeMemberId,
        amount: Number(payoutForm.amount) || 0,
        status: payoutForm.status,
        dueOn: payoutForm.dueOn,
        note: payoutForm.note
      });
      setPayoutForm((current) => ({ ...current, amount: "", note: "" }));
      await refreshFinance();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "報酬レコードを保存できませんでした。");
    } finally {
      setSaving("");
    }
  }

  async function submitInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoiceForm.taskSourceId || !invoiceForm.billedMemberId) return;
    setSaving("invoice");
    setErrorMessage("");
    try {
      await saveTeamWorksProjectInvoice({
        projectSourceId: project.id,
        taskSourceId: invoiceForm.taskSourceId,
        billedMemberId: invoiceForm.billedMemberId,
        amount: Number(invoiceForm.amount) || 0,
        status: invoiceForm.status,
        dueOn: invoiceForm.dueOn,
        note: invoiceForm.note
      });
      setInvoiceForm((current) => ({ ...current, amount: "", note: "" }));
      await refreshFinance();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "請求レコードを保存できませんでした。");
    } finally {
      setSaving("");
    }
  }

  if (status === "loading") return <p className="text-sm text-[var(--mikke-muted)]">報酬・請求データを読み込んでいます。</p>;

  if (status === "error") {
    return (
      <MikkeSection title="報酬・請求">
        <MikkeEmptyState
          title="DB同期後に使える機能です"
          helper={`${errorMessage} 先にプロジェクト一覧のDB同期で、このプロジェクトとタスクを保存してください。`}
        />
        {localTasks.length > 0 ? (
          <p className="mt-3 text-xs font-bold text-[var(--mikke-muted)]">ローカル側には {localTasks.length} 件のタスクがあります。</p>
        ) : null}
      </MikkeSection>
    );
  }

  return (
    <div className="space-y-6">
      {errorMessage ? <p role="alert" className="rounded-lg border border-[var(--mikke-danger)] bg-red-50 px-3 py-2 text-sm font-bold text-[var(--mikke-danger)]">{errorMessage}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <FinanceSummary title="報酬予定" amount={payoutTotal} helper={`${financeState.payouts.length}件・${financeState.payoutsEnabled ? "DB保存有効" : "初回保存で有効化"}`} />
        <FinanceSummary title="請求予定" amount={invoiceTotal} helper={`${financeState.invoices.length}件・${financeState.invoicesEnabled ? "DB保存有効" : "初回保存で有効化"}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MikkeSection title="担当者への報酬を登録">
          {financeState.tasks.length === 0 || workerMembers.length === 0 ? (
            <MikkeEmptyState title="同期済みタスクとworkerメンバーが必要です" helper="DB同期とメンバー招待・参加が完了してから登録できます。" />
          ) : (
            <form onSubmit={submitPayout} className="space-y-3">
              <TeamWorksProjectField label="対象タスク">
                <select value={payoutForm.taskSourceId} onChange={(event) => setPayoutForm({ ...payoutForm, taskSourceId: event.target.value })} className={teamWorksProjectInputClass}>
                  {financeState.tasks.map((task) => <option key={task.id} value={task.sourceId}>{task.title}</option>)}
                </select>
              </TeamWorksProjectField>
              <TeamWorksProjectField label="支払先">
                <select value={payoutForm.payeeMemberId} onChange={(event) => setPayoutForm({ ...payoutForm, payeeMemberId: event.target.value })} className={teamWorksProjectInputClass}>
                  {workerMembers.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
                </select>
              </TeamWorksProjectField>
              <div className="grid gap-3 sm:grid-cols-3">
                <TeamWorksProjectField label="金額">
                  <input value={payoutForm.amount} onChange={(event) => setPayoutForm({ ...payoutForm, amount: event.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" className={teamWorksProjectInputClass} />
                </TeamWorksProjectField>
                <TeamWorksProjectField label="状態">
                  <select value={payoutForm.status} onChange={(event) => setPayoutForm({ ...payoutForm, status: event.target.value as TeamWorksProjectPayoutStatus })} className={teamWorksProjectInputClass}>
                    {Object.entries(payoutStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </TeamWorksProjectField>
                <TeamWorksProjectField label="支払予定日">
                  <input type="date" value={payoutForm.dueOn} onChange={(event) => setPayoutForm({ ...payoutForm, dueOn: event.target.value })} className={teamWorksProjectInputClass} />
                </TeamWorksProjectField>
              </div>
              <TeamWorksProjectField label="メモ">
                <textarea value={payoutForm.note} onChange={(event) => setPayoutForm({ ...payoutForm, note: event.target.value })} rows={2} className={`${teamWorksProjectInputClass} resize-y`} />
              </TeamWorksProjectField>
              <button type="submit" disabled={saving === "payout"} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                <Plus size={15} /> {saving === "payout" ? "保存中" : "報酬を保存"}
              </button>
            </form>
          )}
        </MikkeSection>

        <MikkeSection title="クライアントへの請求を登録">
          {financeState.tasks.length === 0 || clientMembers.length === 0 ? (
            <MikkeEmptyState title="同期済みタスクとclientメンバーが必要です" helper="DB同期とクライアント参加が完了してから登録できます。" />
          ) : (
            <form onSubmit={submitInvoice} className="space-y-3">
              <TeamWorksProjectField label="対象タスク">
                <select value={invoiceForm.taskSourceId} onChange={(event) => setInvoiceForm({ ...invoiceForm, taskSourceId: event.target.value })} className={teamWorksProjectInputClass}>
                  {financeState.tasks.map((task) => <option key={task.id} value={task.sourceId}>{task.title}</option>)}
                </select>
              </TeamWorksProjectField>
              <TeamWorksProjectField label="請求先">
                <select value={invoiceForm.billedMemberId} onChange={(event) => setInvoiceForm({ ...invoiceForm, billedMemberId: event.target.value })} className={teamWorksProjectInputClass}>
                  {clientMembers.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
                </select>
              </TeamWorksProjectField>
              <div className="grid gap-3 sm:grid-cols-3">
                <TeamWorksProjectField label="金額">
                  <input value={invoiceForm.amount} onChange={(event) => setInvoiceForm({ ...invoiceForm, amount: event.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" className={teamWorksProjectInputClass} />
                </TeamWorksProjectField>
                <TeamWorksProjectField label="状態">
                  <select value={invoiceForm.status} onChange={(event) => setInvoiceForm({ ...invoiceForm, status: event.target.value as TeamWorksProjectInvoiceStatus })} className={teamWorksProjectInputClass}>
                    {Object.entries(invoiceStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </TeamWorksProjectField>
                <TeamWorksProjectField label="請求期限">
                  <input type="date" value={invoiceForm.dueOn} onChange={(event) => setInvoiceForm({ ...invoiceForm, dueOn: event.target.value })} className={teamWorksProjectInputClass} />
                </TeamWorksProjectField>
              </div>
              <TeamWorksProjectField label="メモ">
                <textarea value={invoiceForm.note} onChange={(event) => setInvoiceForm({ ...invoiceForm, note: event.target.value })} rows={2} className={`${teamWorksProjectInputClass} resize-y`} />
              </TeamWorksProjectField>
              <button type="submit" disabled={saving === "invoice"} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                <Plus size={15} /> {saving === "invoice" ? "保存中" : "請求を保存"}
              </button>
            </form>
          )}
        </MikkeSection>
      </div>

      <MikkeSection title="保存済みの報酬・請求">
        <div className="grid gap-4 lg:grid-cols-2">
          <FinanceRecordList
            emptyTitle="報酬レコードはまだありません"
            records={financeState.payouts.map((record) => ({
              id: record.id,
              title: record.payeeName,
              helper: record.taskTitle,
              amount: record.amount,
              status: payoutStatusLabels[record.status],
              dueOn: record.dueOn,
              note: record.note
            }))}
          />
          <FinanceRecordList
            emptyTitle="請求レコードはまだありません"
            records={financeState.invoices.map((record) => ({
              id: record.id,
              title: record.billedName,
              helper: record.taskTitle,
              amount: record.amount,
              status: invoiceStatusLabels[record.status],
              dueOn: record.dueOn,
              note: record.note
            }))}
          />
        </div>
      </MikkeSection>
    </div>
  );
}

function FinanceSummary({ title, amount, helper }: { title: string; amount: number; helper: string }) {
  return (
    <div className="rounded-xl border border-[var(--mikke-line)] bg-white p-4">
      <p className="text-xs font-bold text-[var(--mikke-muted)]">{title}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-[var(--mikke-text)]">{amount.toLocaleString("ja-JP")}円</p>
      <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">{helper}</p>
    </div>
  );
}

function FinanceRecordList({ emptyTitle, records }: {
  emptyTitle: string;
  records: { id: string; title: string; helper: string; amount: number; status: string; dueOn: string; note: string }[];
}) {
  if (records.length === 0) return <MikkeEmptyState title={emptyTitle} />;
  return (
    <div className="space-y-2">
      {records.map((record) => (
        <article key={record.id} className="rounded-lg border border-[var(--mikke-line)] p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold">{record.title}</p>
              <p className="mt-1 text-xs text-[var(--mikke-muted)]">{record.helper}</p>
            </div>
            <p className="shrink-0 text-sm font-black">{record.amount.toLocaleString("ja-JP")}円</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-[var(--mikke-muted)]">
            <span>{record.status}</span>
            {record.dueOn ? <span>期限 {record.dueOn}</span> : null}
          </div>
          {record.note ? <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--mikke-text-soft)]">{record.note}</p> : null}
        </article>
      ))}
    </div>
  );
}
