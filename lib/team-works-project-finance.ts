import { supabase } from "@/lib/supabase/client";

export type TeamWorksProjectFinanceStatus = {
  payoutsEnabled: boolean;
  invoicesEnabled: boolean;
};

export type TeamWorksProjectFinanceTask = {
  id: string;
  sourceId: string;
  title: string;
};

export type TeamWorksProjectFinanceMember = {
  id: string;
  displayName: string;
  role: "owner" | "manager" | "client" | "worker";
};

export type TeamWorksProjectPayoutStatus = "draft" | "approved" | "scheduled" | "paid" | "void";
export type TeamWorksProjectInvoiceStatus = "draft" | "issued" | "paid" | "overdue" | "void";

export type TeamWorksProjectPayoutRecord = {
  id: string;
  taskId: string;
  taskSourceId: string;
  taskTitle: string;
  payeeMemberId: string;
  payeeName: string;
  amount: number;
  status: TeamWorksProjectPayoutStatus;
  dueOn: string;
  paidAt: string;
  note: string;
  updatedAt: string;
};

export type TeamWorksProjectInvoiceRecord = {
  id: string;
  taskId: string;
  taskSourceId: string;
  taskTitle: string;
  billedMemberId: string;
  billedName: string;
  amount: number;
  status: TeamWorksProjectInvoiceStatus;
  dueOn: string;
  issuedAt: string;
  paidAt: string;
  note: string;
  updatedAt: string;
};

export type TeamWorksProjectFinanceState = TeamWorksProjectFinanceStatus & {
  tasks: TeamWorksProjectFinanceTask[];
  members: TeamWorksProjectFinanceMember[];
  payouts: TeamWorksProjectPayoutRecord[];
  invoices: TeamWorksProjectInvoiceRecord[];
};

type ProjectRow = {
  id: string;
  payouts_enabled: boolean;
  invoices_enabled: boolean;
};

type TaskRow = {
  id: string;
  source_local_id: string | null;
  title: string;
};

type ProjectMemberRow = {
  organization_member_id: string;
  project_role: TeamWorksProjectFinanceMember["role"];
};

type OrganizationMemberRow = {
  id: string;
  display_name: string;
};

type PayoutRow = {
  id: string;
  task_id: string;
  payee_member_id: string;
  amount: string | number;
  status: TeamWorksProjectPayoutStatus;
  due_on: string | null;
  paid_at: string | null;
  note: string | null;
  updated_at: string;
};

type InvoiceRow = {
  id: string;
  task_id: string;
  billed_member_id: string;
  amount: string | number;
  status: TeamWorksProjectInvoiceStatus;
  due_on: string | null;
  issued_at: string | null;
  paid_at: string | null;
  note: string | null;
  updated_at: string;
};

export async function readTeamWorksProjectFinanceState(projectSourceId: string): Promise<TeamWorksProjectFinanceState> {
  await requireCurrentUser();
  const project = await findProjectBySource(projectSourceId);
  const [tasksResult, projectMembersResult, payoutsResult, invoicesResult] = await Promise.all([
    supabase
      .from("team_works_project_tasks")
      .select("id,source_local_id,title")
      .eq("project_id", project.id)
      .not("source_local_id", "is", null),
    supabase
      .from("team_works_project_members")
      .select("organization_member_id,project_role")
      .eq("project_id", project.id),
    supabase
      .from("team_works_project_payouts")
      .select("id,task_id,payee_member_id,amount,status,due_on,paid_at,note,updated_at")
      .eq("project_id", project.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("team_works_project_invoices")
      .select("id,task_id,billed_member_id,amount,status,due_on,issued_at,paid_at,note,updated_at")
      .eq("project_id", project.id)
      .order("updated_at", { ascending: false })
  ]);
  if (tasksResult.error) throw tasksResult.error;
  if (projectMembersResult.error) throw projectMembersResult.error;
  if (payoutsResult.error) throw payoutsResult.error;
  if (invoicesResult.error) throw invoicesResult.error;

  const projectMembers = (projectMembersResult.data ?? []) as ProjectMemberRow[];
  const memberIds = projectMembers.map((member) => member.organization_member_id);
  let organizationMembers: OrganizationMemberRow[] = [];
  if (memberIds.length > 0) {
    const { data, error } = await supabase
      .from("team_works_organization_members")
      .select("id,display_name")
      .in("id", memberIds);
    if (error) throw error;
    organizationMembers = (data ?? []) as OrganizationMemberRow[];
  }

  const tasks = ((tasksResult.data ?? []) as TaskRow[]).flatMap((task) => (
    task.source_local_id ? [{ id: task.id, sourceId: task.source_local_id, title: task.title }] : []
  ));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const memberNameById = new Map(organizationMembers.map((member) => [member.id, member.display_name]));
  const members = projectMembers.map<TeamWorksProjectFinanceMember>((member) => ({
    id: member.organization_member_id,
    displayName: memberNameById.get(member.organization_member_id) ?? "メンバー",
    role: member.project_role
  }));
  const memberById = new Map(members.map((member) => [member.id, member]));

  return {
    payoutsEnabled: project.payouts_enabled,
    invoicesEnabled: project.invoices_enabled,
    tasks,
    members,
    payouts: ((payoutsResult.data ?? []) as PayoutRow[]).map((row) => {
      const task = taskById.get(row.task_id);
      return {
        id: row.id,
        taskId: row.task_id,
        taskSourceId: task?.sourceId ?? "",
        taskTitle: task?.title ?? "同期済みタスク",
        payeeMemberId: row.payee_member_id,
        payeeName: memberById.get(row.payee_member_id)?.displayName ?? "担当者",
        amount: Number(row.amount) || 0,
        status: row.status,
        dueOn: row.due_on ?? "",
        paidAt: row.paid_at ?? "",
        note: row.note ?? "",
        updatedAt: row.updated_at
      };
    }),
    invoices: ((invoicesResult.data ?? []) as InvoiceRow[]).map((row) => {
      const task = taskById.get(row.task_id);
      return {
        id: row.id,
        taskId: row.task_id,
        taskSourceId: task?.sourceId ?? "",
        taskTitle: task?.title ?? "同期済みタスク",
        billedMemberId: row.billed_member_id,
        billedName: memberById.get(row.billed_member_id)?.displayName ?? "請求先",
        amount: Number(row.amount) || 0,
        status: row.status,
        dueOn: row.due_on ?? "",
        issuedAt: row.issued_at ?? "",
        paidAt: row.paid_at ?? "",
        note: row.note ?? "",
        updatedAt: row.updated_at
      };
    })
  };
}

export async function saveTeamWorksProjectPayout(input: {
  projectSourceId: string;
  taskSourceId: string;
  payeeMemberId: string;
  amount: number;
  status: TeamWorksProjectPayoutStatus;
  dueOn: string;
  note: string;
}) {
  await requireCurrentUser();
  const project = await findProjectBySource(input.projectSourceId);
  const taskId = await findTaskIdBySource(project.id, input.taskSourceId);
  await enableProjectFinance(project.id, "payouts");
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("team_works_project_payouts")
    .upsert({
      project_id: project.id,
      task_id: taskId,
      payee_member_id: input.payeeMemberId,
      amount: normalizeAmount(input.amount),
      status: input.status,
      due_on: input.dueOn || null,
      paid_at: input.status === "paid" ? now : null,
      note: input.note.trim() || null,
      updated_at: now
    }, { onConflict: "task_id,payee_member_id" })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string };
}

export async function saveTeamWorksProjectInvoice(input: {
  projectSourceId: string;
  taskSourceId: string;
  billedMemberId: string;
  amount: number;
  status: TeamWorksProjectInvoiceStatus;
  dueOn: string;
  note: string;
}) {
  await requireCurrentUser();
  const project = await findProjectBySource(input.projectSourceId);
  const taskId = await findTaskIdBySource(project.id, input.taskSourceId);
  await enableProjectFinance(project.id, "invoices");
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("team_works_project_invoices")
    .upsert({
      project_id: project.id,
      task_id: taskId,
      billed_member_id: input.billedMemberId,
      amount: normalizeAmount(input.amount),
      status: input.status,
      due_on: input.dueOn || null,
      issued_at: input.status === "issued" || input.status === "paid" || input.status === "overdue" ? now : null,
      paid_at: input.status === "paid" ? now : null,
      note: input.note.trim() || null,
      updated_at: now
    }, { onConflict: "task_id,billed_member_id" })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string };
}

async function requireCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("報酬・請求のDB保存にはログインが必要です。");
  return data.user;
}

async function findProjectBySource(projectSourceId: string): Promise<ProjectRow> {
  const { data, error } = await supabase
    .from("team_works_projects")
    .select("id,payouts_enabled,invoices_enabled")
    .eq("source_local_id", projectSourceId)
    .single();
  if (error) throw new Error("先にこのプロジェクトをDBへ同期してください。");
  return data as ProjectRow;
}

async function findTaskIdBySource(projectId: string, taskSourceId: string) {
  const { data, error } = await supabase
    .from("team_works_project_tasks")
    .select("id")
    .eq("project_id", projectId)
    .eq("source_local_id", taskSourceId)
    .single();
  if (error) throw new Error("先に対象タスクをDBへ同期してください。");
  return data.id as string;
}

async function enableProjectFinance(projectId: string, kind: "payouts" | "invoices") {
  const patch = kind === "payouts"
    ? { payouts_enabled: true, updated_at: new Date().toISOString() }
    : { invoices_enabled: true, updated_at: new Date().toISOString() };
  const { error } = await supabase
    .from("team_works_projects")
    .update(patch)
    .eq("id", projectId)
    .select("id")
    .single();
  if (error) throw error;
}

function normalizeAmount(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100) / 100;
}
