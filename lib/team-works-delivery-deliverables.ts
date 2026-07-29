import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectDeliverableStatus } from "@/lib/team-works-projects";
import type { DeliveryTask } from "@/lib/team-works-delivery";

// 納品型(style='delivery')の成果物。テーブルはP8-c/P8-f/P8-gで用意済み
// (team_works_project_deliverables)。差し戻し理由はこのテーブルに列が無いため、
// team_works_project_commentsへdeliverable_id付きで記録する(新規テーブルなし)。

export type DeliveryDeliverableType = "url" | "file_placeholder" | "note";
export const deliveryDeliverableTypeLabels: Record<DeliveryDeliverableType, string> = {
  url: "URL",
  file_placeholder: "ファイル",
  note: "メモ"
};

export type DeliveryDeliverable = {
  id: string;
  projectId: string;
  taskId: string;
  // storage(team-works-deliverables)のパスがdeliverable.source_local_idを
  // キーにしている(P8-g)ため、作成時に発行して持たせておく。
  sourceLocalId: string | null;
  title: string;
  deliverableType: DeliveryDeliverableType;
  url: string;
  storagePath: string | null;
  version: number;
  status: ProjectDeliverableStatus;
  submittedByMemberId: string | null;
  reviewedByMemberId: string | null;
  clientVisible: boolean;
  updatedAt: string;
};

const deliverableColumns =
  "id,project_id,task_id,source_local_id,title,deliverable_type,url,storage_path,version,status,submitted_by_member_id,reviewed_by_member_id,client_visible,updated_at";

function toDeliverable(row: Record<string, unknown>): DeliveryDeliverable {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    taskId: row.task_id as string,
    sourceLocalId: (row.source_local_id as string) ?? null,
    title: row.title as string,
    deliverableType: row.deliverable_type as DeliveryDeliverableType,
    url: (row.url as string) ?? "",
    storagePath: (row.storage_path as string) ?? null,
    version: (row.version as number) ?? 1,
    status: row.status as ProjectDeliverableStatus,
    submittedByMemberId: (row.submitted_by_member_id as string) ?? null,
    reviewedByMemberId: (row.reviewed_by_member_id as string) ?? null,
    clientVisible: Boolean(row.client_visible),
    updatedAt: row.updated_at as string
  };
}

export async function fetchTaskDeliverables(client: SupabaseClient, taskId: string): Promise<DeliveryDeliverable[]> {
  const { data, error } = await client
    .from("team_works_project_deliverables")
    .select(deliverableColumns)
    .eq("task_id", taskId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toDeliverable);
}

// workerの自分の提出。1タスクに複数版があり得るため直近1件を返す。
export async function fetchMyDeliverable(client: SupabaseClient, taskId: string, memberId: string): Promise<DeliveryDeliverable | null> {
  const { data, error } = await client
    .from("team_works_project_deliverables")
    .select(deliverableColumns)
    .eq("task_id", taskId)
    .eq("submitted_by_member_id", memberId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toDeliverable(data) : null;
}

// worker本人からのみ呼ぶ。既存(draft/revision_requested)があれば更新、無ければ新規作成。
export async function saveMyDeliverable(
  client: SupabaseClient,
  input: {
    projectId: string;
    taskId: string;
    memberId: string;
    existing: DeliveryDeliverable | null;
    title: string;
    type: DeliveryDeliverableType;
    url: string;
    storagePath?: string | null;
    submit: boolean;
  }
): Promise<DeliveryDeliverable> {
  const status: Extract<ProjectDeliverableStatus, "draft" | "submitted"> = input.submit ? "submitted" : "draft";
  if (input.existing) {
    const { data, error } = await client
      .from("team_works_project_deliverables")
      .update({
        title: input.title.trim(),
        deliverable_type: input.type,
        url: input.type === "url" ? input.url.trim() : "",
        storage_path: input.storagePath ?? input.existing.storagePath,
        status,
        updated_at: new Date().toISOString()
      })
      .eq("id", input.existing.id)
      .select(deliverableColumns)
      .single();
    if (error) throw error;
    return toDeliverable(data);
  }
  const { data, error } = await client
    .from("team_works_project_deliverables")
    .insert({
      project_id: input.projectId,
      task_id: input.taskId,
      source_local_id: crypto.randomUUID(),
      title: input.title.trim(),
      deliverable_type: input.type,
      url: input.type === "url" ? input.url.trim() : "",
      storage_path: input.storagePath ?? null,
      status,
      submitted_by_member_id: input.memberId,
      client_visible: false
    })
    .select(deliverableColumns)
    .single();
  if (error) throw error;
  return toDeliverable(data);
}

// 本部staff用。成果物テーブルはstaffがRLSを全てバイパスできるため直接作成できるが、
// storageへのアップロードは割り当てられたworkerしか行えない(P8-gのstorage RLS)ため、
// ここではURL/メモ形式の直接登録に限る。
export async function createDeliverableAsStaff(
  client: SupabaseClient,
  input: { projectId: string; taskId: string; title: string; type: Extract<DeliveryDeliverableType, "url" | "note">; url: string; submittedByMemberId?: string | null }
): Promise<DeliveryDeliverable> {
  const { data, error } = await client
    .from("team_works_project_deliverables")
    .insert({
      project_id: input.projectId,
      task_id: input.taskId,
      source_local_id: crypto.randomUUID(),
      title: input.title.trim(),
      deliverable_type: input.type,
      url: input.type === "url" ? input.url.trim() : "",
      status: "submitted",
      submitted_by_member_id: input.submittedByMemberId ?? null,
      client_visible: false
    })
    .select(deliverableColumns)
    .single();
  if (error) throw error;
  return toDeliverable(data);
}

const deliverableBucket = "team-works-deliverables";

// P8-gのstorage RLSはオブジェクトパスの第2セグメントをtask.source_local_id、
// 第3セグメントをdeliverable.source_local_idと突き合わせて可否を判定する。
export async function uploadDeliverableFile(
  client: SupabaseClient,
  input: { projectId: string; task: DeliveryTask; deliverableSourceLocalId: string; file: File }
): Promise<{ storagePath: string; signedUrl: string }> {
  if (!input.task.sourceLocalId) throw new Error("この工程は添付ファイルに対応していません。");
  const path = [
    input.projectId,
    input.task.sourceLocalId,
    input.deliverableSourceLocalId,
    `${Date.now()}-${crypto.randomUUID()}-${safeStorageFileName(input.file.name)}`
  ].join("/");
  const { data, error } = await client.storage.from(deliverableBucket).upload(path, input.file, {
    cacheControl: "3600",
    contentType: input.file.type || undefined,
    upsert: true
  });
  if (error) throw error;
  const storagePath = data.path;
  const { data: signed, error: signedError } = await client.storage.from(deliverableBucket).createSignedUrl(storagePath, 60 * 60);
  if (signedError) throw signedError;
  return { storagePath, signedUrl: signed.signedUrl };
}

export async function createSignedDeliverableUrl(client: SupabaseClient, storagePath: string): Promise<string | null> {
  const { data, error } = await client.storage.from(deliverableBucket).createSignedUrl(storagePath, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

// 本部staff用。internal_review/client_reviewへ進める・client_visibleを切り替える等、
// 状態遷移はstaffがRLSをバイパスできるためまとめて1つの更新関数にしている。
export async function updateDeliverableAsStaff(
  client: SupabaseClient,
  deliverableId: string,
  patch: Partial<{ status: ProjectDeliverableStatus; clientVisible: boolean; reviewerMemberId: string }>
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.clientVisible !== undefined) payload.client_visible = patch.clientVisible;
  if (patch.reviewerMemberId !== undefined) payload.reviewed_by_member_id = patch.reviewerMemberId;
  const { error } = await client.from("team_works_project_deliverables").update(payload).eq("id", deliverableId);
  if (error) throw error;
}

// クライアント本人からのみ呼ぶ。RLSがclient_review状態からの承認/修正依頼のみ許可する。
export async function reviewDeliverableAsClient(
  client: SupabaseClient,
  input: { deliverableId: string; memberId: string; nextStatus: Extract<ProjectDeliverableStatus, "revision_requested" | "approved"> }
): Promise<void> {
  const { error } = await client
    .from("team_works_project_deliverables")
    .update({ status: input.nextStatus, reviewed_by_member_id: input.memberId, updated_at: new Date().toISOString() })
    .eq("id", input.deliverableId)
    .eq("status", "client_review");
  if (error) throw error;
}

export type DeliverableComment = {
  id: string;
  deliverableId: string;
  authorMemberId: string;
  audience: "internal" | "client";
  body: string;
  createdAt: string;
};

export async function fetchDeliverableComments(client: SupabaseClient, deliverableId: string): Promise<DeliverableComment[]> {
  const { data, error } = await client
    .from("team_works_project_comments")
    .select("id,deliverable_id,author_member_id,audience,body,created_at")
    .eq("deliverable_id", deliverableId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    deliverableId: row.deliverable_id as string,
    authorMemberId: row.author_member_id as string,
    audience: row.audience as "internal" | "client",
    body: row.body as string,
    createdAt: row.created_at as string
  }));
}

export async function addDeliverableComment(
  client: SupabaseClient,
  input: { projectId: string; deliverableId: string; authorMemberId: string; audience: "internal" | "client"; body: string }
): Promise<void> {
  if (!input.body.trim()) return;
  const { error } = await client.from("team_works_project_comments").insert({
    project_id: input.projectId,
    deliverable_id: input.deliverableId,
    author_member_id: input.authorMemberId,
    audience: input.audience,
    body: input.body.trim()
  });
  if (error) throw error;
}

function safeStorageFileName(name: string) {
  const cleaned = name.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "deliverable-file";
}
