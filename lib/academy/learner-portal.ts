import { supabase } from "@/lib/supabase/client";
import { getAcademyRouteContext } from "@/lib/academy/access-context";
import { academyPreviewApplications, isAcademyLocalReview } from "@/lib/academy/preview";
import type { AcademyApplication } from "@/types/database";

export const ACADEMY_LEARNER_APPLICATION_STATUSES = [
  "paid",
  "kit_pending",
  "kit_preparing",
  "kit_shipped",
  "scheduled",
  "completed",
  "cert_pending",
  "certified",
  "instructor_added"
] as const;

export async function listMyLearnerApplications(userId: string, academyId?: string) {
  if (isAcademyLocalReview()) {
    return academyPreviewApplications.filter((application) => application.status !== "cancelled");
  }

  const explicitAcademyId = academyId ?? getAcademyRouteContext()?.academyId;
  let query = supabase
    .from("academy_applications")
    .select("*")
    .eq("user_id", userId)
    .in("status", [...ACADEMY_LEARNER_APPLICATION_STATUSES])
    .order("created_at", { ascending: false });

  if (explicitAcademyId) query = query.eq("headquarters_id", explicitAcademyId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AcademyApplication[];
}

/** Course membership is not permission to read lesson content. Keep grant checks in the viewer. */
export async function listMyLearnerCourseMemberships(userId: string, academyId?: string) {
  const explicitAcademyId = academyId ?? getAcademyRouteContext()?.academyId;
  if (isAcademyLocalReview()) {
    const legacyApplications = await listMyLearnerApplications(userId, explicitAcademyId);
    return { legacyApplications, courseIds: [...new Set(legacyApplications.map(row => row.course_id))] };
  }
  let query = supabase.from("academy_offering_applications").select("course_ids")
    .eq("learner_user_id", userId).eq("status", "paid");
  if (explicitAcademyId) query = query.eq("headquarters_id", explicitAcademyId);
  const [legacyApplications, offeringResult] = await Promise.all([
    listMyLearnerApplications(userId, explicitAcademyId), query
  ]);
  if (offeringResult.error) throw offeringResult.error;
  const offeringCourseIds = (offeringResult.data ?? []).flatMap(row =>
    Array.isArray(row.course_ids) ? row.course_ids.filter((id: unknown): id is string => typeof id === "string") : []);
  return { legacyApplications, courseIds: [...new Set<string>([...legacyApplications.map(row => row.course_id), ...offeringCourseIds])] };
}
