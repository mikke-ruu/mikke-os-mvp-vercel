import type { ProjectDeliverable, ProjectDeliverableStatus } from "./team-works-projects";

export type ProjectDeliverableActor = "internal" | "client";

export type ProjectDeliverableTransition = {
  status: ProjectDeliverableStatus;
  label: string;
  tone: "primary" | "danger" | "success";
};

const internalTransitions: Partial<Record<ProjectDeliverableStatus, ProjectDeliverableStatus[]>> = {
  draft: ["submitted"],
  submitted: ["internal_review"],
  internal_review: ["revision_requested", "client_review", "approved"],
  revision_requested: ["submitted"],
  approved: ["delivered"]
};

const clientTransitions: Partial<Record<ProjectDeliverableStatus, ProjectDeliverableStatus[]>> = {
  client_review: ["revision_requested", "approved"]
};

const transitionLabels: Record<ProjectDeliverableStatus, string> = {
  draft: "下書きへ戻す",
  submitted: "提出する",
  internal_review: "内部確認を開始",
  client_review: "クライアント確認へ",
  revision_requested: "修正を依頼",
  approved: "承認する",
  delivered: "納品済みにする"
};

export function canTransitionProjectDeliverable(
  deliverable: ProjectDeliverable,
  nextStatus: ProjectDeliverableStatus,
  actor: ProjectDeliverableActor
) {
  const transitions = actor === "client" ? clientTransitions : internalTransitions;
  if (!(transitions[deliverable.status] ?? []).includes(nextStatus)) return false;
  if (nextStatus === "client_review" && !deliverable.clientVisible) return false;
  return true;
}

export function getProjectDeliverableTransitions(
  deliverable: ProjectDeliverable,
  actor: ProjectDeliverableActor
): ProjectDeliverableTransition[] {
  const transitions = actor === "client" ? clientTransitions : internalTransitions;
  return (transitions[deliverable.status] ?? [])
    .filter((status) => canTransitionProjectDeliverable(deliverable, status, actor))
    .map((status) => ({
      status,
      label: deliverable.status === "revision_requested" && status === "submitted" ? "再提出する" : transitionLabels[status],
      tone: status === "revision_requested" ? "danger" : status === "approved" || status === "delivered" ? "success" : "primary"
    }));
}

export function transitionProjectDeliverable({
  deliverable,
  nextStatus,
  actor,
  memberId,
  now = new Date().toISOString()
}: {
  deliverable: ProjectDeliverable;
  nextStatus: ProjectDeliverableStatus;
  actor: ProjectDeliverableActor;
  memberId: string;
  now?: string;
}): ProjectDeliverable {
  if (!canTransitionProjectDeliverable(deliverable, nextStatus, actor)) {
    throw new Error(`Invalid deliverable transition: ${deliverable.status} -> ${nextStatus} (${actor})`);
  }

  return {
    ...deliverable,
    status: nextStatus,
    version: deliverable.status === "revision_requested" && nextStatus === "submitted"
      ? deliverable.version + 1
      : deliverable.version,
    submittedByMemberId: nextStatus === "submitted" ? memberId : deliverable.submittedByMemberId,
    reviewedByMemberId: ["internal_review", "client_review", "revision_requested", "approved"].includes(nextStatus)
      ? memberId
      : deliverable.reviewedByMemberId,
    updatedAt: now
  };
}
