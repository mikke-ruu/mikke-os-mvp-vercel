import { supabase } from "@/lib/supabase/client";

export type ImplementationProjectStatus = "planning" | "active" | "waiting" | "release_waiting" | "completed" | "paused";
export type PublicState = "not_public" | "internal" | "partial" | "public";
export type ImplementationItemStatus = "open" | "in_progress" | "waiting_user" | "approved" | "rejected" | "completed" | "archived";

export type ImplementationProject = {
  id: string; app_key: string; app_name: string; summary: string;
  status: ImplementationProjectStatus; phase: string; current_focus: string;
  public_state: PublicState; verify_path: string; verification_note: string;
  branch_ref: string; sort_order: number; updated_at: string;
};
export type ImplementationGate = {
  id: string; project_id: string; gate_key: string;
  status: "not_applicable" | "not_started" | "in_progress" | "blocked" | "verified";
  summary: string; evidence_ref: string;
};
export type ImplementationItem = {
  id: string; project_id: string | null; item_type: "consultation" | "approval" | "result" | "note";
  status: ImplementationItemStatus; priority: "low" | "normal" | "high" | "urgent";
  title: string; body: string; question: string; result: string; evidence_ref: string;
  task_ref: string; created_at: string; updated_at: string;
  dispatcher_attempts?: number; dispatcher_claimed_at?: string | null; dispatcher_last_error?: string;
};

export async function loadImplementationCenter() {
  const [projectsResult, gatesResult, itemsResult] = await Promise.all([
    supabase.from("mikkeos_implementation_projects").select("*").is("archived_at", null).order("sort_order"),
    supabase.from("mikkeos_implementation_gates").select("*").order("gate_key"),
    supabase.from("mikkeos_implementation_items").select("*").is("archived_at", null).order("created_at", { ascending: false })
  ]);
  const error = projectsResult.error ?? gatesResult.error ?? itemsResult.error;
  if (error) throw new Error(error.message);
  return {
    projects: (projectsResult.data ?? []) as ImplementationProject[],
    gates: (gatesResult.data ?? []) as ImplementationGate[],
    items: (itemsResult.data ?? []) as ImplementationItem[]
  };
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
