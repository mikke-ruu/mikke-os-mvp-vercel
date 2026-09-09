/** Read-only scheme discriminator for existing authorized Academy management roles.
 * This is a UI projection, never the authority for a server-side write.
 */
export type FirstPublicationAccess = {
  scheme: "first_publication_168h_v1";
  policyVersion: string;
  active: boolean;
  inviteAllowed: boolean;
  endsAt: string | null;
  phase: "prepared" | "sync_pending" | "trialing" | "cancelled" | "attention" | "paid" | "expired";
  cancellationAcceptedAt: string | null;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function date(value: unknown): value is string | null {
  return value === null || (typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)));
}
export function parseFirstPublicationAccess(data: unknown): FirstPublicationAccess | null {
  if (data === null) return null;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("invalid_first_publication_access");
  const r = data as Record<string, unknown>;
  if (r.scheme !== "first_publication_168h_v1" || typeof r.policyVersion !== "string" ||
    !r.policyVersion.trim() || r.policyVersion.length > 200 || typeof r.active !== "boolean" ||
    typeof r.inviteAllowed !== "boolean" || !date(r.endsAt) || !date(r.cancellationAcceptedAt) ||
    !["prepared", "sync_pending", "trialing", "cancelled", "attention", "paid", "expired"].includes(String(r.phase))) {
    throw new Error("invalid_first_publication_access");
  }
  if ((r.active && (r.endsAt === null || ["prepared", "attention", "expired"].includes(String(r.phase)))) ||
    (r.inviteAllowed && (!r.active || r.cancellationAcceptedAt !== null || r.phase === "cancelled")) ||
    (r.phase === "cancelled" && r.cancellationAcceptedAt === null)) {
    throw new Error("inconsistent_first_publication_access");
  }
  return {
    scheme: r.scheme, policyVersion: r.policyVersion, active: r.active, inviteAllowed: r.inviteAllowed,
    endsAt: r.endsAt, cancellationAcceptedAt: r.cancellationAcceptedAt,
    phase: r.phase as FirstPublicationAccess["phase"],
  };
}
export function createFirstPublicationAccessRpc(client: {
  rpc(name: "academy_first_publication_access", args: { p_headquarters_id: string }):
    PromiseLike<{ data: unknown; error: unknown }>;
}) {
  return async (headquartersId: string): Promise<FirstPublicationAccess | null> => {
    if (!UUID.test(headquartersId)) throw new Error("invalid_headquarters_id");
    const { data, error } = await client.rpc("academy_first_publication_access", { p_headquarters_id: headquartersId });
    // A missing migration, network error, or denied read must never fall back to legacy access.
    if (error) throw new Error("first_publication_access_failed");
    return parseFirstPublicationAccess(data);
  };
}

/** Subsequent publication only. The DB refuses this path before owner activation. */
export function createFirstPublicationCourseRpc(client: {
  rpc(name: "academy_first_publication_set_course_published", args: {
    p_headquarters_id: string; p_course_id: string; p_published: boolean;
  }): PromiseLike<{ data: unknown; error: unknown }>;
}) {
  return async (headquartersId: string, courseId: string, published: boolean) => {
    if (!UUID.test(headquartersId) || !UUID.test(courseId) || typeof published !== "boolean") throw new Error("invalid_publication_request");
    const { data, error } = await client.rpc("academy_first_publication_set_course_published", {
      p_headquarters_id: headquartersId, p_course_id: courseId, p_published: published,
    });
    if (error) throw new Error("first_publication_course_failed");
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("invalid_publication_result");
    const r = data as Record<string, unknown>;
    if (typeof r.headquarters_id !== "string" || r.headquarters_id.toLowerCase() !== headquartersId.toLowerCase() ||
      typeof r.course_id !== "string" || r.course_id.toLowerCase() !== courseId.toLowerCase() || r.is_published !== published) throw new Error("invalid_publication_result");
    return { headquartersId, courseId, published };
  };
}
