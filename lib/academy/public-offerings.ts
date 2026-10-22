import { academyPublicClient } from "./public-client";
import { existingPublicApplicationIds } from "./public-application-links";

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
  if (!scope.instructorId) {
    const {data: v2, error: v2Error} = await academyPublicClient.rpc("academy2_public_homepage_offerings", {p_hq: scope.headquartersId}).abortSignal(AbortSignal.timeout(30000));
    if (v2Error && v2Error.code !== "PGRST202") throw v2Error;
    if (!v2Error && v2 !== null) return readPublicOfferingSummaries(v2, scope);
  }
  const { data, error } = scope.instructorId
    ? await academyPublicClient.rpc("academy_list_public_instructor_offerings", { p_instructor_id: scope.instructorId }).abortSignal(AbortSignal.timeout(30000))
    : await academyPublicClient.rpc("academy_list_public_offerings", { p_headquarters_id: scope.headquartersId }).abortSignal(AbortSignal.timeout(30000));
  if (error) {
    // Only a missing listing RPC may use already-public application links.
    // Permission, transport and publication errors never select another route.
    if (error.code !== 'PGRST202' || scope.instructorId) throw error;
    const signal = AbortSignal.timeout(30000);
    const {data: available, error: gateError} = await academyPublicClient
      .rpc('academy_is_publicly_available', {p_headquarters_id: scope.headquartersId}).abortSignal(signal);
    if (gateError) throw gateError;
    if (available !== true) return [];
    const {data: headquarters, error: readError} = await academyPublicClient
      .from('academy_headquarters').select('id,front_blocks')
      .eq('id', scope.headquartersId).eq('is_active', true).abortSignal(signal).maybeSingle();
    if (readError) throw readError;
    if (!headquarters) return [];
    const origin = typeof globalThis.location === 'undefined' ? undefined : globalThis.location.origin;
    const ids = existingPublicApplicationIds(headquarters.front_blocks, origin);
    // Do not disguise a missing catalog as an empty completed service listing.
    if (!ids.length) throw error;
    const summaries: unknown[] = [];
    for (const id of ids) {
      const {data: intake, error: intakeError} = await academyPublicClient
        .rpc('academy2_public_intake_with_form', {p_id: id, p_instructor: false}).abortSignal(signal);
      if (intakeError) throw intakeError;
      if (!intake || intake.mode === 'unavailable') continue;
      const offering = intake.offering;
      if (intake.mode !== 'headquarters' || !offering || offering.id !== id
        || offering.headquarters_id !== scope.headquartersId || offering.status !== 'published'
        || !Array.isArray(offering.payment_methods) || !offering.payment_methods.includes('bank')) continue;
      // Use the existing public DTO parser; never spread a manager row or intake.
      summaries.push({id: offering.id, headquarters_id: offering.headquarters_id,
        title: offering.title, kind: offering.kind, course_ids: offering.course_ids,
        price: offering.price, currency: offering.currency, purchase_mode: offering.purchase_mode,
        status: offering.status});
    }
    return readPublicOfferingSummaries(summaries, scope);
  }
  return readPublicOfferingSummaries(data, scope);
}
