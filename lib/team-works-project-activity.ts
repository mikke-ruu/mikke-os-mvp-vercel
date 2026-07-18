import type { UnifiedActivityLog } from "@/lib/mikkeos/types";
import type { Project } from "@/lib/team-works-projects";
import type { TeamWorksProjectInvoiceStatus, TeamWorksProjectPayoutStatus } from "@/lib/team-works-project-finance";

type TeamWorksFinanceActivityBase = {
  project: Project;
  sourceId: string;
  taskTitle: string;
  amount: number;
  dueOn: string;
  occurredAt?: string;
};

export function createTeamWorksPayoutActivity(input: TeamWorksFinanceActivityBase & {
  payeeName: string;
  status: TeamWorksProjectPayoutStatus;
}): UnifiedActivityLog {
  const now = input.occurredAt ?? new Date().toISOString();
  const sourceId = `payout:${input.sourceId}`;
  return {
    id: `team-works-${sourceId}`,
    profileId: "profile-ayumi",
    appKey: "team_works",
    eventType: "team_works_partner_reward_recorded",
    title: `${input.project.name}の報酬を記録`,
    description: `${input.taskTitle} / 支払先: ${input.payeeName}`,
    occurredAt: now,
    amount: input.amount,
    amountType: "expense",
    sourceId,
    visibility: "private",
    storyEnabled: false,
    deskEnabled: true,
    countsTowardSummary: false,
    metadata: {
      category: "other",
      sourceLabel: "Team Works報酬",
      deskGroup: "パートナー報酬",
      paymentStatus: input.status === "paid" ? "paid" : input.status === "void" ? "not_required" : "unpaid",
      location: input.dueOn ? `支払予定 ${input.dueOn}` : undefined
    },
    createdAt: now
  };
}

export function createTeamWorksInvoiceActivity(input: TeamWorksFinanceActivityBase & {
  billedName: string;
  status: TeamWorksProjectInvoiceStatus;
}): UnifiedActivityLog {
  const now = input.occurredAt ?? new Date().toISOString();
  const paid = input.status === "paid";
  const sourceId = `${paid ? "invoice_paid" : "invoice_created"}:${input.sourceId}`;
  return {
    id: `team-works-${sourceId}`,
    profileId: "profile-ayumi",
    appKey: "team_works",
    eventType: paid ? "team_works_invoice_paid" : "team_works_invoice_created",
    title: paid ? `${input.project.name}の入金を確認` : `${input.project.name}の請求を記録`,
    description: `${input.taskTitle} / 請求先: ${input.billedName}`,
    occurredAt: now,
    amount: input.amount,
    amountType: "income",
    sourceId,
    visibility: "private",
    storyEnabled: false,
    deskEnabled: true,
    countsTowardSummary: false,
    metadata: {
      category: "other",
      sourceLabel: paid ? "Team Works入金" : "Team Works請求",
      deskGroup: paid ? "学校入金" : "学校請求",
      paymentStatus: paid ? "paid" : input.status === "void" ? "not_required" : "unpaid",
      location: input.dueOn ? `請求期限 ${input.dueOn}` : undefined
    },
    createdAt: now
  };
}
