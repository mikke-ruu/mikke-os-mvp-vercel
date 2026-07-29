import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectFormField } from "@/lib/team-works-projects";

// 納品型(style='delivery')の工程フォーム。テーブルはP8-cで用意済み(team_works_project_forms)。
// RLSにより、本部staffは全件、worker/clientは自分のinput_actorに一致する
// (かつclientはclient_visibleな)フォームだけが返る。このファイルは本部側UI
// (TeamWorksDeliveryProjectDetail)からのみ呼ぶ想定なので、素直にCRUDするだけでよい。

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
  name: string;
  inputActor: DeliveryFormInputActor;
  required: boolean;
  clientVisible: boolean;
  editableAfterSubmit: boolean;
  fields: ProjectFormField[];
};

const formColumns = "id,project_id,task_id,name,input_actor,required,client_visible,editable_after_submit,fields";

function toDeliveryForm(row: Record<string, unknown>): DeliveryProjectForm {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    taskId: row.task_id as string,
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
