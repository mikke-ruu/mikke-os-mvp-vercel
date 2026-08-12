import { supabase } from "@/lib/supabase/client";

export type HqRole = "owner" | "admin" | "support" | "editor" | "analyst";

export type HqStaffMembership = {
  user_id: string;
  role: HqRole;
  is_active: boolean;
};

export type HqSummary = {
  profiles_total: number;
  profiles_new_30d: number;
  story_users: number;
  community_active_users: number;
  marketnote_users: number;
  active_users_30d: number;
  inquiries_open: number;
  inquiries_urgent: number;
  announcement_drafts: number;
  updates_drafts: number;
};

export type HqTimeseriesPoint = {
  day: string;
  new_profiles: number;
  active_users: number;
  activity_records: number;
};

export type HqInquiryStatus = "new" | "in_progress" | "waiting" | "resolved";
export type HqInquiryPriority = "low" | "normal" | "high" | "urgent";

export type HqInquiry = {
  id: string;
  subject: string;
  body: string;
  contact_name: string;
  contact_email: string;
  app_key: string;
  category: string;
  priority: HqInquiryPriority;
  status: HqInquiryStatus;
  internal_note: string;
  received_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type HqAnnouncement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  severity: "info" | "important" | "maintenance" | "incident";
  status: "draft" | "scheduled" | "published" | "archived";
  starts_at: string | null;
  ends_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type HqUpdate = {
  id: string;
  app_key: string;
  version_label: string;
  title: string;
  summary: string;
  status: "draft" | "published" | "archived";
  released_at: string | null;
  created_at: string;
  updated_at: string;
};

export type HqAuditLog = {
  id: number;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

function requireData<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("データを取得できませんでした。");
  return data;
}

export async function getHqStaffMembership(userId: string): Promise<HqStaffMembership | null> {
  const { data, error } = await supabase
    .from("mikkeos_hq_staff_members")
    .select("user_id, role, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as HqStaffMembership | null;
}

export async function getHqSummary(): Promise<HqSummary> {
  const { data, error } = await supabase
    .from("mikkeos_hq_dashboard_summary")
    .select("summary")
    .maybeSingle();

  return requireData((data?.summary as HqSummary | null) ?? null, error);
}

export async function getHqTimeseries(): Promise<HqTimeseriesPoint[]> {
  const { data, error } = await supabase
    .from("mikkeos_hq_dashboard_timeseries")
    .select("day, new_profiles, active_users, activity_records")
    .order("day", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((point) => ({
    day: String(point.day),
    new_profiles: Number(point.new_profiles),
    active_users: Number(point.active_users),
    activity_records: Number(point.activity_records)
  }));
}

export async function listHqInquiries(): Promise<HqInquiry[]> {
  const { data, error } = await supabase
    .from("mikkeos_hq_inquiries")
    .select("*")
    .order("received_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as HqInquiry[];
}

export async function createHqInquiry(input: {
  subject: string;
  body: string;
  contact_name: string;
  contact_email: string;
  app_key: string;
  category: string;
  priority: HqInquiryPriority;
}): Promise<void> {
  const { error } = await supabase.from("mikkeos_hq_inquiries").insert(input);
  if (error) throw new Error(error.message);
}

export async function updateHqInquiry(
  id: string,
  patch: Partial<Pick<HqInquiry, "status" | "priority" | "internal_note">>
): Promise<void> {
  const nextPatch: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  if (patch.status === "resolved") nextPatch.resolved_at = new Date().toISOString();
  if (patch.status && patch.status !== "resolved") nextPatch.resolved_at = null;
  const { error } = await supabase.from("mikkeos_hq_inquiries").update(nextPatch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listHqAnnouncements(): Promise<HqAnnouncement[]> {
  const { data, error } = await supabase
    .from("mikkeos_hq_announcements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as HqAnnouncement[];
}

export async function createHqAnnouncement(input: {
  title: string;
  body: string;
  audience: string;
  severity: HqAnnouncement["severity"];
  status: "draft" | "published";
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("mikkeos_hq_announcements").insert({
    ...input,
    published_at: input.status === "published" ? now : null,
    starts_at: input.status === "published" ? now : null
  });
  if (error) throw new Error(error.message);
}

export async function updateHqAnnouncementStatus(
  id: string,
  status: HqAnnouncement["status"]
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("mikkeos_hq_announcements")
    .update({
      status,
      updated_at: now,
      published_at: status === "published" ? now : null,
      starts_at: status === "published" ? now : null
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listHqUpdates(): Promise<HqUpdate[]> {
  const { data, error } = await supabase
    .from("mikkeos_hq_updates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as HqUpdate[];
}

export async function createHqUpdate(input: {
  app_key: string;
  version_label: string;
  title: string;
  summary: string;
  status: "draft" | "published";
}): Promise<void> {
  const { error } = await supabase.from("mikkeos_hq_updates").insert({
    ...input,
    released_at: input.status === "published" ? new Date().toISOString() : null
  });
  if (error) throw new Error(error.message);
}

export async function updateHqUpdateStatus(id: string, status: HqUpdate["status"]): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("mikkeos_hq_updates")
    .update({ status, updated_at: now, released_at: status === "published" ? now : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listHqAuditLogs(): Promise<HqAuditLog[]> {
  const { data, error } = await supabase
    .from("mikkeos_hq_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as HqAuditLog[];
}
