/** Inject the existing authenticated user client. Never inject a service-role client in a browser. */
export interface FirstPublicationRpcClient {
  rpc(name: "academy_first_publication_command", args: {
    p_headquarters_id: string; p_action: string; p_course_id: string | null;
    p_quote_id: string | null; p_confirmed: boolean;
    p_terms_revision: string | null; p_amount_yen: number | null;
  }): PromiseLike<{ data: unknown; error: unknown }>;
}
export type FirstPublicationStatus = {
  headquartersId: string; policyVersion: string; termsRevision: string; quoteId: string;
  amountYen: number; instructorCount: number;
  firstPublishedAt: string | null; trialEndsAt: string | null; cancellationAcceptedAt: string | null;
  phase: "prepared" | "sync_pending" | "trialing" | "cancelled" | "attention";
};
export type FirstPublicationQuote = {
  id: string; headquartersId: string; policyVersion: string; termsRevision: string;
  amountYen: number; instructorCount: number; issuedAt: string; expiresAt: string;
};
type Command =
  | { action: "status" }
  | { action: "prepare"; quoteId: string; termsRevision: string; amountYen: number; consent: boolean }
  | { action: "publish"; courseId: string; quoteId: string; confirmed: boolean }
  | { action: "unpublish"; courseId: string }
  | { action: "cancel_conversion" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(value: unknown): value is string { return typeof value === "string" && UUID.test(value); }
function required(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function text(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 200; }
function date(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)));
}
export function parseFirstPublicationStatus(data: unknown, headquartersId: string): FirstPublicationStatus {
  required(data && typeof data === "object" && !Array.isArray(data), "invalid_first_publication_response");
  const row = data as Record<string, unknown>;
  required(uuid(row.headquarters_id) && row.headquarters_id.toLowerCase() === headquartersId.toLowerCase() &&
    text(row.policy_version) && text(row.terms_revision) && uuid(row.quote_id), "invalid_first_publication_scope");
  required(typeof row.amount_yen === "number" && Number.isSafeInteger(row.amount_yen) && row.amount_yen > 0 &&
    typeof row.instructor_count === "number" && Number.isSafeInteger(row.instructor_count) && row.instructor_count >= 0, "invalid_first_publication_amount");
  required(date(row.first_published_at) && date(row.trial_ends_at) && date(row.cancellation_accepted_at), "invalid_first_publication_time");
  required((row.first_published_at === null && row.trial_ends_at === null) ||
    (row.first_published_at !== null && row.trial_ends_at !== null && Date.parse(row.trial_ends_at) - Date.parse(row.first_published_at) === 168 * 3600000),
    "invalid_first_publication_window");
  required(["prepared", "sync_pending", "trialing", "cancelled", "attention"].includes(String(row.phase)), "invalid_first_publication_phase");
  required(row.phase !== "prepared" || row.first_published_at === null, "invalid_first_publication_phase");
  required(!["sync_pending", "trialing"].includes(String(row.phase)) || row.first_published_at !== null, "invalid_first_publication_phase");
  required((row.phase === "cancelled") === (row.cancellation_accepted_at !== null), "invalid_first_publication_cancellation");
  return {
    headquartersId: row.headquarters_id, policyVersion: row.policy_version, termsRevision: row.terms_revision,
    quoteId: row.quote_id, amountYen: row.amount_yen, instructorCount: row.instructor_count,
    firstPublishedAt: row.first_published_at, trialEndsAt: row.trial_ends_at,
    cancellationAcceptedAt: row.cancellation_accepted_at, phase: row.phase as FirstPublicationStatus["phase"],
  }; // Deliberately omit provider preparation IDs, owner IDs, and arbitrary RPC fields.
}
export function createFirstPublicationRpc(client: FirstPublicationRpcClient) {
  return async function command(headquartersId: string, input: Command): Promise<FirstPublicationStatus | null> {
    required(uuid(headquartersId), "invalid_headquarters_id");
    required(input && ["status", "prepare", "publish", "unpublish", "cancel_conversion"].includes(input.action), "invalid_command");
    if (input.action === "prepare") required(uuid(input.quoteId) && text(input.termsRevision) &&
      Number.isSafeInteger(input.amountYen) && input.amountYen > 0 && input.consent === true, "explicit_consent_required");
    if (input.action === "publish") required(uuid(input.courseId) && uuid(input.quoteId) && input.confirmed === true, "publication_confirmation_required");
    if (input.action === "unpublish") required(uuid(input.courseId), "invalid_course_id");
    const { data, error } = await client.rpc("academy_first_publication_command", {
      p_headquarters_id: headquartersId, p_action: input.action,
      p_course_id: input.action === "publish" || input.action === "unpublish" ? input.courseId : null,
      p_quote_id: input.action === "prepare" || input.action === "publish" ? input.quoteId : null,
      p_confirmed: input.action === "prepare" ? input.consent : input.action === "publish" ? input.confirmed : false,
      p_terms_revision: input.action === "prepare" ? input.termsRevision : null,
      p_amount_yen: input.action === "prepare" ? input.amountYen : null,
    });
    // Errors are not zero members, no contract, or successful publication. No automatic retries.
    if (error) throw new Error("first_publication_request_failed");
    if (data === null && input.action === "status") return null;
    return parseFirstPublicationStatus(data, headquartersId);
  };
}
export function createFirstPublicationQuoteRpc(client: {
  rpc(name: "academy_first_publication_quote", args: { p_headquarters_id: string; p_policy_version: string }): PromiseLike<{data: unknown; error: unknown}>;
}) {
  return async (headquartersId: string, policyVersion: string): Promise<FirstPublicationQuote> => {
    required(uuid(headquartersId) && text(policyVersion), "invalid_quote_request");
    const {data,error}=await client.rpc("academy_first_publication_quote",{p_headquarters_id:headquartersId,p_policy_version:policyVersion});
    if(error) throw new Error("first_publication_quote_failed");
    required(data && typeof data === "object" && !Array.isArray(data), "invalid_quote_response");
    const row=data as Record<string,unknown>;
    required(uuid(row.id) && uuid(row.headquarters_id) && row.headquarters_id.toLowerCase()===headquartersId.toLowerCase() &&
      row.policy_version===policyVersion && text(row.terms_revision), "invalid_quote_scope");
    required(typeof row.amount_yen === "number" && Number.isSafeInteger(row.amount_yen) && row.amount_yen>0 &&
      typeof row.instructor_count === "number" && Number.isSafeInteger(row.instructor_count) && row.instructor_count>=0, "invalid_quote_amount");
    required(date(row.issued_at) && row.issued_at!==null && date(row.expires_at) && row.expires_at!==null &&
      Date.parse(row.expires_at)>Date.parse(row.issued_at), "invalid_quote_time");
    return {id:row.id,headquartersId:row.headquarters_id,policyVersion,termsRevision:row.terms_revision,
      amountYen:row.amount_yen,instructorCount:row.instructor_count,issuedAt:row.issued_at,expiresAt:row.expires_at};
  };
}
