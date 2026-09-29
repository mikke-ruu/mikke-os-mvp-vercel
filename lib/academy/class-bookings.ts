import { supabase } from "@/lib/supabase/client";

export type ClassBooking = {
  id: string; application_id: string; class_id: string; course_id: string;
  headquarters_id: string; learner_user_id: string; status: "assigned" | "cancelled";
  assigned_at: string; cancelled_at: string | null;
};
export type AssignmentClass = {
  id: string; headquarters_id: string; course_id: string; title: string;
  starts_at: string | null; ends_at: string | null;
  schedule_mode: "fixed" | "arranged_after_application"; format: "online" | "in_person";
  capacity: number | null; assigned_count: number; remaining_capacity: number | null;
};
export type RosterBooking = ClassBooking & { learner_name: string };
export type MyBooking = ClassBooking & {
  class_title: string; starts_at: string | null; ends_at: string | null;
  schedule_mode: string; format: string; venue_name: string | null;
  class_status: string; meeting_url: string | null;
};
type Row = Record<string, unknown>;
function record(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid booking response");
  return value as Row;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid booking text");
  return value;
}
function nullable(value: unknown): string | null { return value === null ? null : string(value); }
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid booking count");
  return value;
}
function rows<T>(value: unknown, read: (row: Row) => T): T[] {
  if (!Array.isArray(value)) throw new Error("Invalid booking list");
  return value.map(row => read(record(row)));
}
function booking(row: Row): ClassBooking {
  if (row.status !== "assigned" && row.status !== "cancelled") throw new Error("Invalid booking status");
  return { id: string(row.id), application_id: string(row.application_id), class_id: string(row.class_id), course_id: string(row.course_id),
    headquarters_id: string(row.headquarters_id), learner_user_id: string(row.learner_user_id), status: row.status,
    assigned_at: string(row.assigned_at), cancelled_at: nullable(row.cancelled_at) };
}
async function rpc(name: string, args?: Record<string, string>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as unknown;
}
export async function listAssignmentClasses(applicationId: string, headquartersId: string) {
  return rows(await rpc("academy_list_assignment_classes", { p_application_id: applicationId }), row => {
    if (row.headquarters_id !== headquartersId || !["fixed", "arranged_after_application"].includes(string(row.schedule_mode)) || !["online", "in_person"].includes(string(row.format))) throw new Error("Invalid class scope");
    return { id: string(row.id), headquarters_id: headquartersId, course_id: string(row.course_id), title: string(row.title),
      starts_at: nullable(row.starts_at), ends_at: nullable(row.ends_at), schedule_mode: row.schedule_mode as AssignmentClass["schedule_mode"], format: row.format as AssignmentClass["format"],
      capacity: row.capacity === null ? null : count(row.capacity), assigned_count: count(row.assigned_count), remaining_capacity: row.remaining_capacity === null ? null : count(row.remaining_capacity) };
  });
}
export async function listClassBookings(classId: string, headquartersId: string) {
  return rows(await rpc("academy_list_class_bookings", { p_class_id: classId }), row => {
    const item = booking(row);
    if (item.class_id !== classId || item.headquarters_id !== headquartersId) throw new Error("Invalid roster scope");
    return { ...item, learner_name: string(row.learner_name) };
  });
}
export async function listMyOfferingBookings(userId: string) {
  return rows(await rpc("academy_list_my_offering_bookings"), row => {
    const item = booking(row);
    if (item.learner_user_id !== userId) throw new Error("Invalid learner scope");
    return { ...item, class_title: string(row.class_title), starts_at: nullable(row.starts_at), ends_at: nullable(row.ends_at),
      schedule_mode: string(row.schedule_mode), format: string(row.format), venue_name: nullable(row.venue_name),
      class_status: string(row.class_status), meeting_url: nullable(row.meeting_url) };
  });
}
export async function assignPaidApplicationClass(applicationId: string, classId: string, requestId: string) {
  const row = record(await rpc("academy_assign_paid_application_class", { p_application_id: applicationId, p_class_id: classId, p_request_id: requestId }));
  if (row.version !== 1 || !["assigned", "already_assigned", "full"].includes(string(row.outcome)) || typeof row.replayed !== "boolean") throw new Error("Invalid assignment result");
  const item = row.booking === null ? null : booking(record(row.booking));
  if (row.outcome === "full" ? item !== null : !item || item.class_id !== classId) throw new Error("Invalid assignment booking");
  return { outcome: row.outcome as "assigned" | "already_assigned" | "full", booking: item, replayed: row.replayed };
}
export async function cancelOfferingClassBooking(bookingId: string, requestId: string) {
  const row = record(await rpc("academy_cancel_offering_class_booking", { p_booking_id: bookingId, p_request_id: requestId }));
  const item = booking(record(row.booking));
  if (row.version !== 1 || row.outcome !== "cancelled" || typeof row.replayed !== "boolean" || item.id !== bookingId || item.status !== "cancelled") throw new Error("Invalid cancellation result");
  return item;
}
export function bookingDate(value: string | null) {
  return value ? new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "日程は個別に相談";
}
export function safeMeetingUrl(value: string | null) {
  try { const url = new URL(value ?? ""); return url.protocol === "https:" ? url.href : null; } catch { return null; }
}
