/** Two independent authenticated RPC transactions. An append is never a receipt. */
export type FirstPublicationCancellationReceipt = {
  status: "accepted";
  receiptId: string;
  headquartersId: string;
  requestReceivedAt: string;
  durableAcknowledgedAt: string;
  sequence: number;
  trialEndsAt: string;
};

export interface FirstPublicationCancellationRpcClient {
  rpc(name: "academy_first_publication_cancel_append" | "academy_first_publication_cancel_acknowledge", args: {
    p_headquarters_id: string;
    p_idempotency_key: string;
  }): PromiseLike<{ data: unknown; error: unknown }>;
}

export type FirstPublicationCancellationStatus = null
  | { status: "awaiting_durable_acknowledgment"; idempotencyKey: string }
  | FirstPublicationCancellationReceipt & { idempotencyKey: string; applied: boolean };

export type FirstPublicationCancellationBoundary = {
  /** Recheck the current authenticated actor and original account scope; throw on a change. */
  assertCurrentActor: () => void | Promise<void>;
  signal?: AbortSignal;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

function isReceiptTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, y, m, d, h, minute, second, zone] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()
    || Number(h) > 23 || Number(minute) > 59 || Number(second) > 59) return false;
  return zone === "Z" || Number(zone.slice(1, 3)) <= 23 && Number(zone.slice(4)) <= 59;
}

function receiptMicroseconds(value: string) {
  const fraction = /\.([0-9]{1,6})/.exec(value)?.[1] ?? "";
  return BigInt(Date.parse(value)) * BigInt(1000) + BigInt(fraction.padEnd(6, "0").slice(3));
}

async function checkBoundary(boundary: FirstPublicationCancellationBoundary) {
  boundary.signal?.throwIfAborted();
  await boundary.assertCurrentActor();
  boundary.signal?.throwIfAborted();
}

function validateInput(headquartersId: string, idempotencyKey: string | undefined, boundary: FirstPublicationCancellationBoundary) {
  if (!UUID.test(headquartersId) || idempotencyKey !== undefined && !UUID.test(idempotencyKey) || typeof boundary?.assertCurrentActor !== "function") throw new Error("invalid_first_publication_cancellation_input");
}

export function parseFirstPublicationCancellationReceipt(value: unknown, headquartersId: string): FirstPublicationCancellationReceipt {
  if (!UUID.test(headquartersId) || !isRecord(value) || value.status !== "accepted"
    || typeof value.receipt_id !== "string" || !UUID.test(value.receipt_id)
    || typeof value.headquarters_id !== "string" || !UUID.test(value.headquarters_id) || value.headquarters_id.toLowerCase() !== headquartersId.toLowerCase()
    || !isReceiptTime(value.request_received_at) || !isReceiptTime(value.durable_acknowledged_at) || !isReceiptTime(value.trial_ends_at)
    || typeof value.sequence !== "number" || !Number.isSafeInteger(value.sequence) || value.sequence <= 0
    || receiptMicroseconds(value.durable_acknowledged_at) < receiptMicroseconds(value.request_received_at)) {
    throw new Error("invalid_first_publication_cancellation_receipt");
  }
  // Scope, IDs, and timestamps are validated, but only the DB decides deadline acceptance.
  // Do not forward internal fields, provider details, or arbitrary response properties.
  return { status: "accepted", receiptId: value.receipt_id, headquartersId: value.headquarters_id,
    requestReceivedAt: value.request_received_at, durableAcknowledgedAt: value.durable_acknowledged_at,
    sequence: value.sequence, trialEndsAt: value.trial_ends_at };
}

export function createFirstPublicationCancellationAcknowledgmentClient(client: FirstPublicationCancellationRpcClient) {
  return async function acknowledge(input: { headquartersId: string; idempotencyKey: string }, boundary: FirstPublicationCancellationBoundary): Promise<FirstPublicationCancellationReceipt> {
    if (!input || typeof input.idempotencyKey !== "string") throw new Error("invalid_first_publication_cancellation_input");
    validateInput(input.headquartersId, input.idempotencyKey, boundary);
    const { headquartersId, idempotencyKey } = input;
    await checkBoundary(boundary);
    let acknowledged: { data: unknown; error: unknown };
    try { acknowledged = await client.rpc("academy_first_publication_cancel_acknowledge", { p_headquarters_id: headquartersId, p_idempotency_key: idempotencyKey }); }
    catch { throw new Error("first_publication_cancellation_acknowledgment_unconfirmed"); }
    finally { await checkBoundary(boundary); }
    if (acknowledged.error) throw new Error("first_publication_cancellation_acknowledgment_unconfirmed");
    return parseFirstPublicationCancellationReceipt(acknowledged.data, headquartersId);
  };
}

export function createFirstPublicationCancellationStatusClient(client: {
  rpc(name: "academy_first_publication_cancel_status", args: { p_headquarters_id: string }): PromiseLike<{ data: unknown; error: unknown }>;
}) {
  return async function read(headquartersId: string, boundary: FirstPublicationCancellationBoundary): Promise<FirstPublicationCancellationStatus> {
    validateInput(headquartersId, undefined, boundary);
    await checkBoundary(boundary);
    let result: { data: unknown; error: unknown };
    try { result = await client.rpc("academy_first_publication_cancel_status", { p_headquarters_id: headquartersId }); }
    catch { throw new Error("first_publication_cancellation_status_unavailable"); }
    finally { await checkBoundary(boundary); }
    if (result.error) throw new Error("first_publication_cancellation_status_unavailable");
    if (result.data === null) return null;
    const row = result.data;
    if (!isRecord(row) || typeof row.idempotency_key !== "string" || !UUID.test(row.idempotency_key)) throw new Error("invalid_first_publication_cancellation_status");
    if (row.status === "awaiting_durable_acknowledgment") return { status: row.status, idempotencyKey: row.idempotency_key };
    if (typeof row.applied !== "boolean") throw new Error("invalid_first_publication_cancellation_status");
    return { ...parseFirstPublicationCancellationReceipt(row, headquartersId), idempotencyKey: row.idempotency_key, applied: row.applied };
  };
}

export function createFirstPublicationCancellationClient(client: FirstPublicationCancellationRpcClient) {
  return async function cancel(input: { headquartersId: string; idempotencyKey: string }, boundary: FirstPublicationCancellationBoundary): Promise<FirstPublicationCancellationReceipt> {
    if (!input || !UUID.test(input.headquartersId) || !UUID.test(input.idempotencyKey) || typeof boundary?.assertCurrentActor !== "function") {
      throw new Error("invalid_first_publication_cancellation_input");
    }
    const requestScope = { headquartersId: input.headquartersId, idempotencyKey: input.idempotencyKey };
    const args = { p_headquarters_id: requestScope.headquartersId, p_idempotency_key: requestScope.idempotencyKey };
    await checkBoundary(boundary);
    let appended: { data: unknown; error: unknown };
    try { appended = await client.rpc("academy_first_publication_cancel_append", args); }
    catch { throw new Error("first_publication_cancellation_append_unconfirmed"); }
    finally { await checkBoundary(boundary); }
    if (appended.error || !isRecord(appended.data) || appended.data.status !== "awaiting_durable_acknowledgment") {
      throw new Error("first_publication_cancellation_append_unconfirmed");
    }
    // This second RPC begins only after the append transaction's response has arrived.
    return createFirstPublicationCancellationAcknowledgmentClient(client)(requestScope, boundary);
  };
}
