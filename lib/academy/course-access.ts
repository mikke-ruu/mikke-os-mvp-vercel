import { supabase } from "@/lib/supabase/client";
import { academyPreviewCourseAccessGrants, isAcademyLocalReview } from "@/lib/academy/preview";
import type { AcademyCourseAccessGrant } from "@/types/database";

export type AcademyCourseAccessState = "active" | "upcoming" | "expired" | "revoked" | "missing";

export async function listMyCourseAccessGrants(courseIds: string[]) {
  if (courseIds.length === 0) return [];
  if (isAcademyLocalReview()) {
    return academyPreviewCourseAccessGrants.filter((grant) => courseIds.includes(grant.course_id));
  }

  const { data, error } = await supabase
    .from("academy_course_access_grants")
    .select("*")
    .in("course_id", courseIds)
    .order("starts_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AcademyCourseAccessGrant[];
}

export function resolveCourseAccessGrant(
  grants: AcademyCourseAccessGrant[],
  courseId: string,
  now = new Date()
) {
  const courseGrants = grants
    .filter((grant) => grant.course_id === courseId)
    .sort((left, right) => new Date(right.starts_at).getTime() - new Date(left.starts_at).getTime());

  const active = courseGrants.find((grant) => {
    if (grant.status !== "active") return false;
    const startsAt = new Date(grant.starts_at).getTime();
    const endsAt = grant.ends_at ? new Date(grant.ends_at).getTime() : Number.POSITIVE_INFINITY;
    return startsAt <= now.getTime() && now.getTime() < endsAt;
  });
  if (active) return { state: "active" as const, grant: active };

  const upcoming = courseGrants.find(
    (grant) => grant.status === "active" && new Date(grant.starts_at).getTime() > now.getTime()
  );
  if (upcoming) return { state: "upcoming" as const, grant: upcoming };

  const expired = courseGrants.find(
    (grant) => grant.status === "active" && !!grant.ends_at && new Date(grant.ends_at).getTime() <= now.getTime()
  );
  if (expired) return { state: "expired" as const, grant: expired };

  const revoked = courseGrants.find((grant) => grant.status === "revoked");
  if (revoked) return { state: "revoked" as const, grant: revoked };

  return { state: "missing" as const, grant: null };
}
