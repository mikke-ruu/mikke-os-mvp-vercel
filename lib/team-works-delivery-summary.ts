import type { ProjectFormSubmission } from "@/lib/team-works-projects";
import type { DeliveryProjectMember, DeliveryTask } from "@/lib/team-works-delivery";
import type { DeliveryProjectForm } from "@/lib/team-works-delivery-forms";
import type { DeliveryDeliverable } from "@/lib/team-works-delivery-deliverables";

// Phase 5:「今、誰の番か」を導出する純粋関数群。新しい状態列は追加せず、
// task.owner_role と、紐づくsubmission/deliverableの状態から導き出す。

export type DeliveryActionUrgency = "action_needed" | "revision" | "review_needed";

export type DeliveryActionItem = {
  taskId: string;
  taskTitle: string;
  kind: "form" | "deliverable";
  urgency: DeliveryActionUrgency;
  dueOn: string | null;
  detail: string;
  reviewMemo?: string;
};

const doneLikeTaskStatuses: DeliveryTask["status"][] = ["completed", "cancelled", "archived"];

function taskById(tasks: DeliveryTask[]) {
  return new Map(tasks.map((task) => [task.id, task]));
}

function sortByDueOn(items: DeliveryActionItem[]): DeliveryActionItem[] {
  const urgencyOrder: Record<DeliveryActionUrgency, number> = { revision: 0, action_needed: 1, review_needed: 2 };
  return [...items].sort((a, b) => {
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    if (!a.dueOn && !b.dueOn) return 0;
    if (!a.dueOn) return 1;
    if (!b.dueOn) return -1;
    return a.dueOn.localeCompare(b.dueOn);
  });
}

// ワーカー/クライアントポータル向け。「自分が今すぐ対応すべきこと」を返す。
// submissionsはRLSにより自分の提出しか返ってこない前提(fetchSubmissionsByFormIds等)。
export function buildMyDeliveryActionItems(input: {
  tasks: DeliveryTask[];
  forms: DeliveryProjectForm[];
  submissions: ProjectFormSubmission[];
  deliverables: DeliveryDeliverable[];
  myMembership: DeliveryProjectMember;
}): DeliveryActionItem[] {
  const tasksById = taskById(input.tasks);
  const items: DeliveryActionItem[] = [];
  const role = input.myMembership.projectRole;
  const myId = input.myMembership.organizationMemberId;

  const mySubmissionByFormId = new Map(input.submissions.map((submission) => [submission.formId, submission]));
  for (const form of input.forms) {
    if (form.inputActor !== role) continue;
    const task = tasksById.get(form.taskId);
    if (!task || doneLikeTaskStatuses.includes(task.status)) continue;
    const submission = mySubmissionByFormId.get(form.id);
    if (!submission || submission.status === "draft") {
      items.push({ taskId: task.id, taskTitle: task.title, kind: "form", urgency: "action_needed", dueOn: task.submitDueOn ?? task.dueOn, detail: `${form.name}を提出してください` });
    } else if (submission.status === "revision_requested") {
      items.push({ taskId: task.id, taskTitle: task.title, kind: "form", urgency: "revision", dueOn: task.submitDueOn ?? task.dueOn, detail: `${form.name}に修正依頼があります`, reviewMemo: submission.reviewMemo });
    }
  }

  if (role === "worker") {
    for (const task of input.tasks) {
      if (task.ownerRole !== "worker" || task.assigneeMemberId !== myId) continue;
      if (task.submissionType !== "file" && task.submissionType !== "url") continue;
      if (doneLikeTaskStatuses.includes(task.status)) continue;
      const mine = input.deliverables.filter((deliverable) => deliverable.taskId === task.id && deliverable.submittedByMemberId === myId);
      const latest = mine[0];
      if (!latest || latest.status === "draft") {
        items.push({ taskId: task.id, taskTitle: task.title, kind: "deliverable", urgency: "action_needed", dueOn: task.submitDueOn ?? task.dueOn, detail: `${task.title}の成果物を提出してください` });
      } else if (latest.status === "revision_requested") {
        items.push({ taskId: task.id, taskTitle: task.title, kind: "deliverable", urgency: "revision", dueOn: task.submitDueOn ?? task.dueOn, detail: `${task.title}の成果物に修正依頼があります` });
      }
    }
  }

  if (role === "client") {
    for (const deliverable of input.deliverables) {
      if (deliverable.status !== "client_review") continue;
      const task = tasksById.get(deliverable.taskId);
      items.push({ taskId: deliverable.taskId, taskTitle: task?.title ?? deliverable.title, kind: "deliverable", urgency: "review_needed", dueOn: task?.dueOn ?? null, detail: `${deliverable.title}を確認してください` });
    }
  }

  return sortByDueOn(items);
}

export type DeliveryStaffPendingSummary = {
  clientWaitingCount: number;
  staffReviewCount: number;
  overdueCount: number;
  items: DeliveryActionItem[];
};

// 本部ダッシュボード向け。「クライアント待ち／本部確認待ち／期限超過」の件数と、
// 誰待ちかの一覧を返す。submissions/deliverablesはstaffなのでRLSにより全件返る前提。
export function buildStaffPendingSummary(input: {
  tasks: DeliveryTask[];
  forms: DeliveryProjectForm[];
  submissions: ProjectFormSubmission[];
  deliverables: DeliveryDeliverable[];
}): DeliveryStaffPendingSummary {
  const tasksById = taskById(input.tasks);
  const items: DeliveryActionItem[] = [];
  let clientWaitingCount = 0;
  let staffReviewCount = 0;

  const submissionsByFormId = new Map<string, ProjectFormSubmission[]>();
  for (const submission of input.submissions) {
    const list = submissionsByFormId.get(submission.formId) ?? [];
    list.push(submission);
    submissionsByFormId.set(submission.formId, list);
  }

  for (const form of input.forms) {
    const task = tasksById.get(form.taskId);
    if (!task || doneLikeTaskStatuses.includes(task.status)) continue;
    const submissions = submissionsByFormId.get(form.id) ?? [];
    for (const submission of submissions) {
      if (submission.status === "submitted") {
        staffReviewCount += 1;
        items.push({ taskId: task.id, taskTitle: task.title, kind: "form", urgency: "review_needed", dueOn: task.dueOn, detail: `${form.name}の確認待ち` });
      } else if (form.inputActor === "client" && submission.status === "revision_requested") {
        clientWaitingCount += 1;
        items.push({ taskId: task.id, taskTitle: task.title, kind: "form", urgency: "action_needed", dueOn: task.submitDueOn ?? task.dueOn, detail: `${form.name}のクライアント再提出待ち` });
      }
    }
    if (form.inputActor === "client" && submissions.length === 0) {
      clientWaitingCount += 1;
      items.push({ taskId: task.id, taskTitle: task.title, kind: "form", urgency: "action_needed", dueOn: task.submitDueOn ?? task.dueOn, detail: `${form.name}のクライアント提出待ち` });
    }
  }

  for (const deliverable of input.deliverables) {
    const task = tasksById.get(deliverable.taskId);
    if (!task || doneLikeTaskStatuses.includes(task.status)) continue;
    if (deliverable.status === "submitted" || deliverable.status === "internal_review") {
      staffReviewCount += 1;
      items.push({ taskId: task.id, taskTitle: task.title, kind: "deliverable", urgency: "review_needed", dueOn: task.dueOn, detail: `${deliverable.title}の確認待ち` });
    } else if (deliverable.status === "client_review") {
      clientWaitingCount += 1;
      items.push({ taskId: task.id, taskTitle: task.title, kind: "deliverable", urgency: "action_needed", dueOn: task.dueOn, detail: `${deliverable.title}のクライアント承認待ち` });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = input.tasks.filter((task) => {
    if (doneLikeTaskStatuses.includes(task.status)) return false;
    const dateOn = task.submitDueOn ?? task.dueOn;
    return Boolean(dateOn && dateOn < today);
  }).length;

  return { clientWaitingCount, staffReviewCount, overdueCount, items: sortByDueOn(items) };
}
