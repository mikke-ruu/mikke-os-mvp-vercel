import { academyPublicClient } from "./public-client";

// Public DTO only. Never use the manager's table listing on anonymous pages.
export type PublicOfferingSummary = {
  id: string;
  headquarters_id: string;
  title: string;
  kind: string;
  course_ids: string[];
  price: number;
  currency: "JPY";
  purchase_mode: "all" | "staged";
  status: "published";
};
export type PublicOfferingScope = { headquartersId: string; instructorId?: string; courseId?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readPublicOfferingSummaries(data: unknown, scope: PublicOfferingScope): PublicOfferingSummary[] {
  if (!Array.isArray(data)) throw new Error("invalid_public_offering_list");
  const seen = new Set<string>();
  return data.flatMap(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_public_offering");
    const row = value as Record<string, unknown>;
    if (row.status !== "published" || row.headquarters_id !== scope.headquartersId) return [];
    if (typeof row.id !== "string" || !uuid.test(row.id) || typeof row.title !== "string" || !row.title.trim()
      || typeof row.kind !== "string" || !Array.isArray(row.course_ids) || !row.course_ids.length
      || row.course_ids.some(id => typeof id !== "string" || !uuid.test(id))
      || typeof row.price !== "number" || !Number.isSafeInteger(row.price) || row.price < 0
      || row.currency !== "JPY" || (row.purchase_mode !== "all" && row.purchase_mode !== "staged")) {
      throw new Error("invalid_public_offering");
    }
    if (scope.courseId && !row.course_ids.includes(scope.courseId)) return [];
    if (seen.has(row.id)) return [];
    seen.add(row.id);
    return [{ id: row.id, headquarters_id: scope.headquartersId, title: row.title, kind: row.kind,
      course_ids: row.course_ids as string[], price: row.price, currency: "JPY" as const,
      purchase_mode: row.purchase_mode, status: "published" as const }];
  });
}

export async function listPublicOfferings(scope: PublicOfferingScope) {
  const { data, error } = scope.instructorId
    ? await academyPublicClient.rpc("academy_list_public_instructor_offerings", { p_instructor_id: scope.instructorId }).abortSignal(AbortSignal.timeout(30000))
    : await academyPublicClient.rpc("academy_list_public_offerings", { p_headquarters_id: scope.headquartersId }).abortSignal(AbortSignal.timeout(30000));
  if (error) throw error;
  return readPublicOfferingSummaries(data, scope);
}
