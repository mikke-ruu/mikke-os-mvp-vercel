import { supabase } from "@/lib/supabase/client";
import type { AcademyClassInstructorRequest } from "@/types/database";

const requestDetails =
  "*, class:academy_classes(id,title,starts_at,ends_at,format,status,course_id,venue_name,meeting_url,course:academy_courses(id,code,name)), instructor:academy_instructors(id,business_name,profile_id,user_id)";

export const CLASS_INSTRUCTOR_REQUEST_STATUS_LABELS: Record<
  AcademyClassInstructorRequest["status"],
  string
> = {
  requested: "回答待ち",
  accepted: "承諾",
  declined: "辞退",
  cancelled: "取消"
};

export async function listClassInstructorRequests(headquartersId: string) {
  const { data, error } = await supabase
    .from("academy_class_instructor_requests")
    .select(requestDetails)
    .eq("headquarters_id", headquartersId)
    .order("requested_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as AcademyClassInstructorRequest[];
}

export async function listMyClassInstructorRequests() {
  const { data, error } = await supabase
    .from("academy_class_instructor_requests")
    .select(requestDetails)
    .order("requested_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as AcademyClassInstructorRequest[];
}

export async function createClassInstructorRequest(input: {
  headquartersId: string;
  classId: string;
  instructorId: string;
  requestNote: string;
  respondBy: string | null;
  requestedByUserId: string;
}) {
  const { data, error } = await supabase
    .from("academy_class_instructor_requests")
    .insert({
      headquarters_id: input.headquartersId,
      class_id: input.classId,
      instructor_id: input.instructorId,
      request_note: input.requestNote.trim() || null,
      respond_by: input.respondBy,
      requested_by_user_id: input.requestedByUserId
    })
    .select(requestDetails)
    .single();

  if (error) throw error;
  return data as unknown as AcademyClassInstructorRequest;
}

export async function respondClassInstructorRequest(
  requestId: string,
  status: Extract<AcademyClassInstructorRequest["status"], "accepted" | "declined">,
  responseNote: string
) {
  const { data, error } = await supabase.rpc("academy_respond_class_instructor_request", {
    p_request_id: requestId,
    p_status: status,
    p_response_note: responseNote.trim() || null
  });

  if (error) throw error;
  return data as unknown as AcademyClassInstructorRequest;
}

export async function cancelClassInstructorRequest(requestId: string) {
  const { data, error } = await supabase.rpc("academy_cancel_class_instructor_request", {
    p_request_id: requestId
  });

  if (error) throw error;
  return data as unknown as AcademyClassInstructorRequest;
}
