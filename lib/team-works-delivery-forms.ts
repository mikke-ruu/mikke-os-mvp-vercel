import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectFormAnswerValue, ProjectFormAttachmentAnswer, ProjectFormField, ProjectFormSubmission, ProjectFormSubmissionStatus } from "@/lib/team-works-projects";

// 納品型(style='delivery')の工程フォーム。テーブルはP8-cで用意済み(team_works_project_forms /
// team_works_form_submissions)。RLSにより、本部staffは全件、worker/clientは自分の
// input_actorに一致する(かつclientはclient_visibleな)フォーム・提出だけが返る。

export type DeliveryFormInputActor = "admin" | "worker" | "client";
export const deliveryFormInputActorLabels: Record<DeliveryFormInputActor, string> = {
  admin: "本部",
  worker: "担当メンバー",
  client: "クライアント"
};

export type DeliveryProjectForm = {
  id: string;
  projectId: string;
  taskId: string;
  // storage(team-works-form-attachments)のパスがform.source_local_idをキーにしている
  // (P8-h)ため、作成時に発行して持たせておく。表示上の意味は持たない内部識別子。
  sourceLocalId: string | null;
  name: string;
  inputActor: DeliveryFormInputActor;
  required: boolean;
  clientVisible: boolean;
  editableAfterSubmit: boolean;
  fields: ProjectFormField[];
};

const formColumns = "id,project_id,task_id,source_local_id,name,input_actor,required,client_visible,editable_after_submit,fields";

function toDeliveryForm(row: Record<string, unknown>): DeliveryProjectForm {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    taskId: row.task_id as string,
    sourceLocalId: (row.source_local_id as string) ?? null,
    name: row.name as string,
    inputActor: row.input_actor as DeliveryFormInputActor,
    required: Boolean(row.required),
    clientVisible: Boolean(row.client_visible),
    editableAfterSubmit: Boolean(row.editable_after_submit),
    fields: (row.fields as ProjectFormField[]) ?? []
  };
}

export async function fetchTaskForms(client: SupabaseClient, taskId: string): Promise<DeliveryProjectForm[]> {
  const { data, error } = await client
    .from("team_works_project_forms")
    .select(formColumns)
    .eq("task_id", taskId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toDeliveryForm);
}

export async function createTaskForm(
  client: SupabaseClient,
  input: { projectId: string; taskId: string; name: string; inputActor: DeliveryFormInputActor }
): Promise<DeliveryProjectForm> {
  const { data, error } = await client
    .from("team_works_project_forms")
    .insert({
      project_id: input.projectId,
      task_id: input.taskId,
      source_local_id: crypto.randomUUID(),
      name: input.name.trim(),
      input_actor: input.inputActor,
      fields: []
    })
    .select(formColumns)
    .single();
  if (error) throw error;
  return toDeliveryForm(data);
}

export async function updateTaskForm(
  client: SupabaseClient,
  formId: string,
  patch: Partial<{
    name: string;
    inputActor: DeliveryFormInputActor;
    required: boolean;
    clientVisible: boolean;
    editableAfterSubmit: boolean;
    fields: ProjectFormField[];
  }>
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.inputActor !== undefined) payload.input_actor = patch.inputActor;
  if (patch.required !== undefined) payload.required = patch.required;
  if (patch.clientVisible !== undefined) payload.client_visible = patch.clientVisible;
  if (patch.editableAfterSubmit !== undefined) payload.editable_after_submit = patch.editableAfterSubmit;
  if (patch.fields !== undefined) payload.fields = patch.fields;
  const { error } = await client.from("team_works_project_forms").update(payload).eq("id", formId);
  if (error) throw error;
}

export async function archiveTaskForm(client: SupabaseClient, formId: string): Promise<void> {
  const { error } = await client
    .from("team_works_project_forms")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", formId);
  if (error) throw error;
}

// --- 提出(team_works_form_submissions) ---------------------------------
// unique(form_id, submitted_by_member_id) が1人1提出を保証しているので、
// source_local_idは「form_id:member_id」から毎回導出すればよく、
// 別途保存・追跡する必要がない(P8-hのstorageパスの第2セグメントで使う)。

const submissionColumns =
  "id,project_id,form_id,submitted_by_member_id,answers,status,review_memo,reviewed_by_member_id,approved_by_member_id,submitted_at,created_at,updated_at";

function submissionSourceLocalId(formId: string, memberId: string) {
  return `${formId}:${memberId}`;
}

// ProjectFormSubmission.submittedByActorは元々localStorage版の型で、この
// ファイルの呼び出し元では未使用(承認フローはmember_idとstatusだけで動く)。
// 型を満たすためだけにform.inputActorから引き当てる(adminの場合はworker扱い)。
function toSubmission(row: Record<string, unknown>, actor: "client" | "worker"): ProjectFormSubmission {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    formId: row.form_id as string,
    submittedByActor: actor,
    submittedById: row.submitted_by_member_id as string,
    answers: (row.answers as Record<string, ProjectFormAnswerValue>) ?? {},
    status: row.status as ProjectFormSubmissionStatus,
    reviewMemo: (row.review_memo as string) ?? "",
    reviewedByMemberId: (row.reviewed_by_member_id as string) ?? "",
    approvedByMemberId: (row.approved_by_member_id as string) ?? "",
    submittedAt: (row.submitted_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  };
}

export async function fetchMyFormSubmission(client: SupabaseClient, form: DeliveryProjectForm, memberId: string): Promise<ProjectFormSubmission | null> {
  const { data, error } = await client
    .from("team_works_form_submissions")
    .select(submissionColumns)
    .eq("form_id", form.id)
    .eq("submitted_by_member_id", memberId)
    .maybeSingle();
  if (error) throw error;
  return data ? toSubmission(data, form.inputActor === "client" ? "client" : "worker") : null;
}

export async function fetchFormSubmissions(client: SupabaseClient, form: DeliveryProjectForm): Promise<ProjectFormSubmission[]> {
  const { data, error } = await client
    .from("team_works_form_submissions")
    .select(submissionColumns)
    .eq("form_id", form.id)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => toSubmission(row, form.inputActor === "client" ? "client" : "worker"));
}

// 記入者(worker/client)本人からのみ呼ぶ。差し戻し後の再提出も含め、
// reviewed_by_member_id/approved_by_member_idを明示的にnullへ戻さないと
// RLSのWITH CHECK(「非staffの更新は審査欄が空であること」)を満たせない。
export async function saveMyFormSubmission(
  client: SupabaseClient,
  input: { projectId: string; formId: string; memberId: string; answers: Record<string, ProjectFormAnswerValue>; submit: boolean }
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await client.from("team_works_form_submissions").upsert(
    {
      project_id: input.projectId,
      form_id: input.formId,
      submitted_by_member_id: input.memberId,
      source_local_id: submissionSourceLocalId(input.formId, input.memberId),
      answers: sanitizeFormAttachmentAnswers(input.answers),
      status: input.submit ? "submitted" : "draft",
      review_memo: "",
      reviewed_by_member_id: null,
      approved_by_member_id: null,
      submitted_at: input.submit ? now : null,
      updated_at: now
    },
    { onConflict: "form_id,submitted_by_member_id" }
  );
  if (error) throw error;
}

// 本部staffが提出を審査する。承認/差し戻し(理由必須)の2択に限定するのはUI側。
export async function reviewFormSubmission(
  client: SupabaseClient,
  input: { formId: string; submittedByMemberId: string; reviewerMemberId: string; nextStatus: Extract<ProjectFormSubmissionStatus, "revision_requested" | "approved">; reviewMemo: string }
): Promise<void> {
  const { error } = await client
    .from("team_works_form_submissions")
    .update({
      status: input.nextStatus,
      review_memo: input.reviewMemo.trim(),
      reviewed_by_member_id: input.reviewerMemberId,
      approved_by_member_id: input.nextStatus === "approved" ? input.reviewerMemberId : null,
      updated_at: new Date().toISOString()
    })
    .eq("form_id", input.formId)
    .eq("submitted_by_member_id", input.submittedByMemberId)
    .eq("status", "submitted");
  if (error) throw error;
}

const formAttachmentBucket = "team-works-form-attachments";

// P8-hのstorage RLSはオブジェクトパスの第2セグメントをform.source_local_id、
// 第4セグメントをfields[].idと突き合わせて書き込み可否を判定する
// (第3セグメントは自由記述で構わない: team_works_can_write_form_attachment_object参照)。
// 読み出し時の自分の提出との紐付けのため、第3セグメントにも同じ導出値を使う。
export async function uploadMyFormAttachment(
  client: SupabaseClient,
  input: { projectId: string; form: DeliveryProjectForm; memberId: string; fieldId: string; file: File }
): Promise<ProjectFormAttachmentAnswer> {
  if (!input.form.sourceLocalId) throw new Error("このフォームは添付ファイルに対応していません。");
  const path = [
    input.projectId,
    input.form.sourceLocalId,
    submissionSourceLocalId(input.form.id, input.memberId),
    input.fieldId,
    `${Date.now()}-${crypto.randomUUID()}-${safeStorageFileName(input.file.name)}`
  ].join("/");
  const { data, error } = await client.storage.from(formAttachmentBucket).upload(path, input.file, {
    cacheControl: "3600",
    contentType: input.file.type || undefined,
    upsert: true
  });
  if (error) throw error;
  const storagePath = data.path;
  const { data: signed, error: signedError } = await client.storage.from(formAttachmentBucket).createSignedUrl(storagePath, 60 * 60);
  if (signedError) throw signedError;
  return {
    kind: "storage_attachment",
    fileName: input.file.name,
    storagePath,
    signedUrl: signed.signedUrl,
    contentType: input.file.type || undefined,
    size: input.file.size,
    uploadedAt: new Date().toISOString()
  };
}

function isFormAttachmentAnswer(value: ProjectFormAnswerValue | undefined): value is ProjectFormAttachmentAnswer {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && "kind" in value && value.kind === "storage_attachment" && "storagePath" in value);
}

function sanitizeFormAttachmentAnswers(answers: Record<string, ProjectFormAnswerValue>): Record<string, ProjectFormAnswerValue> {
  return Object.fromEntries(
    Object.entries(answers).map(([fieldId, value]) => {
      if (!isFormAttachmentAnswer(value)) return [fieldId, value];
      const attachment = { ...value };
      delete attachment.signedUrl;
      return [fieldId, attachment];
    })
  );
}

function safeStorageFileName(name: string) {
  const cleaned = name.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "attachment";
}
