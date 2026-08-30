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
