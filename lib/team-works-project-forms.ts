import type {
  ProjectForm,
  ProjectFormAnswerValue,
  ProjectFormSubmission,
  ProjectFormSubmissionStatus
} from "./team-works-projects";

export type TeamWorksFormActor = {
  kind: "client" | "worker" | "admin";
  id: string;
  memberId?: string;
};

export function requiredProjectFormFieldsComplete(form: Pick<ProjectForm, "fields">, answers: Record<string, ProjectFormAnswerValue>) {
  return form.fields.filter((field) => field.required).every((field) => {
    const value = answers[field.id];
    if (Array.isArray(value)) return value.length > 0;
    if (isProjectFormAttachmentAnswer(value)) return value.storagePath.trim().length > 0;
    if (typeof value === "boolean") return value;
    return value !== undefined && value !== null && String(value).trim().length > 0;
  });
}

export function isProjectFormAttachmentAnswer(value: ProjectFormAnswerValue | undefined): value is Extract<ProjectFormAnswerValue, { kind: "storage_attachment" }> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && "kind" in value && value.kind === "storage_attachment" && "storagePath" in value);
}

export function canEditProjectFormSubmission(submission: ProjectFormSubmission | null, editableAfterSubmit: boolean) {
  if (!submission) return true;
  return submission.status === "draft" || submission.status === "revision_requested" || (submission.status === "submitted" && editableAfterSubmit);
}

export function saveProjectFormAnswers({
  submission,
  projectId,
  formId,
  actor,
  answers,
  editableAfterSubmit,
  now,
  createId
}: {
  submission: ProjectFormSubmission | null;
  projectId: string;
  formId: string;
  actor: { kind: "client" | "worker"; id: string };
  answers: Record<string, ProjectFormAnswerValue>;
  editableAfterSubmit: boolean;
  now: string;
  createId: (prefix: string) => string;
}) {
  if (submission && (submission.submittedByActor !== actor.kind || submission.submittedById !== actor.id)) return submission;
  if (submission?.status === "approved" || (submission?.status === "submitted" && !editableAfterSubmit)) return submission;
  return {
    id: submission?.id ?? createId("team_works_project_form_submission"),
    projectId,
    formId,
    submittedByActor: actor.kind,
    submittedById: actor.id,
    answers,
    status: submission?.status === "revision_requested" ? "revision_requested" : "draft",
    reviewMemo: submission?.reviewMemo ?? "",
    reviewedByMemberId: submission?.reviewedByMemberId ?? "",
    approvedByMemberId: submission?.approvedByMemberId ?? "",
    submittedAt: submission?.submittedAt ?? null,
    createdAt: submission?.createdAt ?? now,
    updatedAt: now
  } satisfies ProjectFormSubmission;
}

export function transitionProjectFormSubmission({
  submission,
  nextStatus,
  actor,
  reviewMemo,
  now
}: {
  submission: ProjectFormSubmission;
  nextStatus: ProjectFormSubmissionStatus;
  actor: TeamWorksFormActor;
  reviewMemo?: string;
  now: string;
}) {
  if (actor.kind !== "admin") {
    if (submission.submittedByActor !== actor.kind || submission.submittedById !== actor.id) return submission;
    if (nextStatus !== "submitted" || !["draft", "revision_requested"].includes(submission.status)) return submission;
    return { ...submission, status: "submitted" as const, reviewMemo: "", submittedAt: now, updatedAt: now };
  }
  if (submission.status !== "submitted" || !["revision_requested", "approved"].includes(nextStatus)) return submission;
  return {
    ...submission,
    status: nextStatus,
    reviewMemo: reviewMemo?.trim() ?? "",
    reviewedByMemberId: actor.memberId ?? actor.id,
    approvedByMemberId: nextStatus === "approved" ? actor.memberId ?? actor.id : "",
    updatedAt: now
  };
}
