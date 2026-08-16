import { supabase } from "@/lib/supabase/client";

export type ImplementationProjectStatus = "planning" | "active" | "waiting" | "release_waiting" | "completed" | "paused";
export type PublicState = "not_public" | "internal" | "partial" | "public";
export type ImplementationItemStatus = "open" | "in_progress" | "waiting_user" | "approved" | "rejected" | "completed" | "archived";
export type ImplementationConversationStatus = "active" | "queued" | "responding" | "executing" | "waiting_user" | "archived";
export type ImplementationMessageMode = "discussion" | "execution";
export type ImplementationLane = "request" | "proposal" | "local_result" | "production_result";

export type ImplementationProject = {
  id: string; app_key: string; app_name: string; summary: string;
  status: ImplementationProjectStatus; phase: string; current_focus: string;
  public_state: PublicState; verify_path: string; verification_note: string;
  branch_ref: string; sort_order: number; updated_at: string;
  roadmap_stage: "idea" | "prototype" | "local_build" | "local_ready" | "release_ready" | "released" | "operating" | "paused";
  next_action: string; local_state: "none" | "planned" | "in_progress" | "implemented" | "tested";
  local_verify_url: string; local_evidence_ref: string; production_url: string;
  release_target_date: string | null; app_menu_state: "not_listed" | "planned" | "ready" | "listed";
  homepage_state: "not_listed" | "planned" | "ready" | "listed";
};
export type ImplementationGate = {
  id: string; project_id: string; gate_key: string;
  status: "not_applicable" | "not_started" | "in_progress" | "blocked" | "verified";
  summary: string; evidence_ref: string;
};
export type ImplementationItem = {
  id: string; project_id: string | null; item_type: "consultation" | "approval" | "result" | "note" | ImplementationLane | "handoff";
  status: ImplementationItemStatus; priority: "low" | "normal" | "high" | "urgent";
  title: string; body: string; question: string; result: string; evidence_ref: string;
  task_ref: string; created_at: string; updated_at: string;
  origin_project_id?: string | null; source_conversation_id?: string | null; source_message_id?: string | null;
  local_verify_url?: string; production_url?: string;
  dispatcher_attempts?: number; dispatcher_claimed_at?: string | null; dispatcher_last_error?: string;
};
export type ImplementationConversation = {
  id: string; project_id: string | null; title: string;
  status: ImplementationConversationStatus; branch_ref: string;
  last_message_at: string; last_response_at: string | null;
  progress_stage: string; progress_note: string; progress_updated_at: string | null;
  created_at: string; updated_at: string;
};
export type ImplementationMessage = {
  id: string; conversation_id: string; role: "user" | "assistant";
  mode: ImplementationMessageMode; status: "pending" | "in_progress" | "completed" | "failed";
  content: string; evidence_ref: string; created_at: string; updated_at: string;
  decision_question: string; recommended_execution: string;
};
export type ImplementationAttachment = {
  id: string; conversation_id: string; message_id: string | null; storage_path: string;
  file_name: string; mime_type: string; size_bytes: number; created_at: string;
};

export async function loadImplementationCenter() {
  const [projectsResult, gatesResult, itemsResult, conversationsResult, messagesResult, attachmentsResult] = await Promise.all([
    supabase.from("mikkeos_implementation_projects").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("mikkeos_implementation_gates").select("*").order("gate_key"),
    supabase.from("mikkeos_implementation_items").select("*").is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("mikkeos_implementation_conversations").select("*").is("archived_at", null).order("last_message_at", { ascending: false }),
    supabase.from("mikkeos_implementation_messages").select("*").order("created_at", { ascending: true }),
    supabase.from("mikkeos_implementation_attachments").select("id,conversation_id,message_id,storage_path,file_name,mime_type,size_bytes,created_at").order("created_at", { ascending: true })
  ]);
  const error = projectsResult.error ?? gatesResult.error ?? itemsResult.error ?? conversationsResult.error ?? messagesResult.error ?? attachmentsResult.error;
  if (error) throw new Error(error.message);
  return {
    projects: (projectsResult.data ?? []) as ImplementationProject[],
    gates: (gatesResult.data ?? []) as ImplementationGate[],
    items: (itemsResult.data ?? []) as ImplementationItem[],
    conversations: (conversationsResult.data ?? []) as ImplementationConversation[],
    messages: (messagesResult.data ?? []) as ImplementationMessage[],
    attachments: (attachmentsResult.data ?? []) as ImplementationAttachment[]
  };
}

export async function createImplementationConversation(input: { projectId: string | null; title: string }) {
  const { data, error } = await supabase.rpc("mikkeos_create_implementation_conversation", {
    p_project_id: input.projectId,
    p_title: input.title,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function startImplementationConversation(input: {
  projectId: string | null; title: string; content: string;
}) {
  const { data, error } = await supabase.rpc("mikkeos_start_implementation_conversation", {
    p_project_id: input.projectId,
    p_title: input.title,
    p_content: input.content,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function sendImplementationMessage(input: {
  conversationId: string; mode: ImplementationMessageMode; content: string; attachmentIds?: string[];
}) {
  const { data, error } = await supabase.rpc("mikkeos_send_implementation_message_v2", {
    p_conversation_id: input.conversationId,
    p_mode: input.mode,
    p_content: input.content,
    p_attachment_ids: input.attachmentIds ?? [],
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function uploadImplementationAttachments(input: {
  conversationId: string; files: File[]; userId: string;
}) {
  if (input.files.length > 3) throw new Error("画像は一度に3枚まで添付できます。");
  const attachmentIds: string[] = [];
  for (const file of input.files) {
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      throw new Error("PNG・JPEG・WebP・GIFを、1枚10MB以内で添付してください。");
    }
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "-").slice(-120) || "image";
    const storagePath = `${input.userId}/${input.conversationId}/${crypto.randomUUID()}-${safeName}`;
    const bucket = supabase.storage.from("mikkeos-implementation-attachments");
    const upload = await bucket.upload(storagePath, file, { contentType: file.type, upsert: false });
    if (upload.error) throw new Error(upload.error.message);
    const signed = await bucket.createSignedUrl(storagePath, 24 * 60 * 60);
    if (signed.error) {
      await bucket.remove([storagePath]);
      throw new Error(signed.error.message);
    }
    const { data, error } = await supabase.from("mikkeos_implementation_attachments").insert({
      conversation_id: input.conversationId,
      storage_path: storagePath,
      file_name: file.name.slice(0, 240),
      mime_type: file.type,
      size_bytes: file.size,
      worker_url: signed.data.signedUrl,
      worker_url_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_by: input.userId,
    }).select("id").single();
    if (error) {
      await bucket.remove([storagePath]);
      throw new Error(error.message);
    }
    attachmentIds.push(String(data.id));
  }
  return attachmentIds;
}

export async function openImplementationAttachment(storagePath: string) {
  const { data, error } = await supabase.storage
    .from("mikkeos-implementation-attachments")
    .createSignedUrl(storagePath, 10 * 60);
  if (error) throw new Error(error.message);
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export async function createImplementationConsultation(input: {
  projectId: string | null; title: string; body: string;
  priority: ImplementationItem["priority"]; userId: string;
}) {
  const { error } = await supabase.from("mikkeos_implementation_items").insert({
    project_id: input.projectId, item_type: "consultation", status: "open",
    priority: input.priority, title: input.title, body: input.body,
    created_by: input.userId, updated_by: input.userId
  });
  if (error) throw new Error(error.message);
}

export async function updateImplementationItemStatus(id: string, status: ImplementationItemStatus, userId: string) {
  const { error } = await supabase.from("mikkeos_implementation_items").update({
    status, updated_by: userId, updated_at: new Date().toISOString(),
    completed_at: ["approved", "rejected", "completed"].includes(status) ? new Date().toISOString() : null
  }).eq("id", id);
  if (error) throw new Error(error.message);
}
