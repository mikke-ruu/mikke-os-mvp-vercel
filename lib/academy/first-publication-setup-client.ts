import type { FirstPublicationQuote } from "./first-publication/rpc-client";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENDPOINT = "/academy/api/first-publication/setup";

export function parseConfirmedSetupQuote(value: unknown, headquartersId: string, quoteId: string): FirstPublicationQuote {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("確認済みの見積もりを取得できませんでした。");
  const row=value as Record<string,unknown>;
  if (row.id!==quoteId || row.headquartersId!==headquartersId || typeof row.policyVersion!=="string" || !row.policyVersion.trim() || row.policyVersion.length>200 || typeof row.termsRevision!=="string" || !row.termsRevision.trim() || row.termsRevision.length>200 || typeof row.amountYen!=="number" || !Number.isSafeInteger(row.amountYen) || row.amountYen<=0 || typeof row.instructorCount!=="number" || !Number.isSafeInteger(row.instructorCount) || row.instructorCount<0 || typeof row.issuedAt!=="string" || typeof row.expiresAt!=="string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(row.issuedAt) || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(row.expiresAt) || !Number.isFinite(Date.parse(row.issuedAt)) || !Number.isFinite(Date.parse(row.expiresAt)) || Date.parse(row.expiresAt)<=Date.parse(row.issuedAt)) throw new Error("見積もりの対象・料金・期限を確認できませんでした。");
  return {id:quoteId,headquartersId,policyVersion:row.policyVersion,termsRevision:row.termsRevision,amountYen:row.amountYen,instructorCount:row.instructorCount,issuedAt:row.issuedAt,expiresAt:row.expiresAt};
}

export function approvedAcademySetupUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("支払方法の登録先を確認できませんでした。");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("支払方法の登録先を確認できませんでした。"); }
  if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" || url.port || url.username || url.password) {
    throw new Error("支払方法の登録先を確認できませんでした。");
  }
  return url.href;
}

/** Inject the current owner's token. Neither URL parameters nor local storage are payment proof. */
export function createAcademySetupClient(getToken: () => Promise<string>, request: typeof fetch = fetch) {
  async function post(path: string, body: Record<string, string>, signal?: AbortSignal) {
    if (!UUID.test(body.headquartersId) || !UUID.test(body.quoteId)) throw new Error("本部と料金の見積もりを確認してください。");
    const token = await getToken();
    signal?.throwIfAborted();
    if (!token) throw new Error("もう一度ログインしてください。");
    const response = await request(path, {
      method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error", signal,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: unknown = await response.json().catch(() => null);
    signal?.throwIfAborted();
    if (!response.ok || !data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("支払方法の登録結果を確認できませんでした。再申し込みせず、現在の状態を確認してください。");
    }
    return data as Record<string, unknown>;
  }
  return {
    async start(headquartersId: string, quoteId: string, signal?: AbortSignal) {
      const data = await post(ENDPOINT, { headquartersId, quoteId }, signal);
      if (typeof data.attemptId !== "string" || !UUID.test(data.attemptId)) throw new Error("支払方法の登録手続きを確認できませんでした。");
      return { attemptId: data.attemptId, setupUrl: approvedAcademySetupUrl(data.setupUrl) };
    },
    async confirm(headquartersId: string, quoteId: string, attemptId: string, signal?: AbortSignal) {
      if (!UUID.test(attemptId)) throw new Error("支払方法の登録手続きを確認できませんでした。");
      const data = await post(`${ENDPOINT}/confirm`, { headquartersId, quoteId, attemptId }, signal);
      if (data.verified !== true || typeof data.paymentPreparationId !== "string" || !UUID.test(data.paymentPreparationId)) {
        throw new Error("支払方法はまだ確認できていません。契約準備は完了していません。");
      }
      return { paymentPreparationId: data.paymentPreparationId, verified: true as const, quote: parseConfirmedSetupQuote(data.quote,headquartersId,quoteId) };
    },
  };
}
