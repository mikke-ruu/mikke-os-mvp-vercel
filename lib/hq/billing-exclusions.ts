import { supabase } from "@/lib/supabase/client";

export type AcademyBillingExclusionState = {
  version: 1;
  adminHandle: "ayumi";
  headquarters: Array<{ id: string; name: string }>;
  exclusions: Array<{ id: string; headquartersId: string; headquartersName: string; targetHandle: string; reason: string; effectiveFrom: string; effectiveUntil: string | null; active: boolean }>;
};

async function token() {
  const { data, error } = await supabase.auth.getSession();
  const value = data.session?.access_token;
  if (error || !value) throw new Error("ログインを確認できませんでした。");
  return value;
}

async function request(init?: RequestInit) {
  const response = await fetch("/api/hq/billing-exclusions", {
    ...init,
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${await token()}`, ...init?.headers }
  });
  const data: unknown = await response.json().catch(() => null);
  const errorMessage = data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>).error
    : null;
  if (!response.ok) throw new Error(typeof errorMessage === "string" ? errorMessage : "課金対象外設定を処理できませんでした。");
  return data;
}

function text(value: unknown, max = 200) { return typeof value === "string" && value.length > 0 && value.length <= max ? value : null; }
function uuid(value: unknown) { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null; }

export async function loadAcademyBillingExclusions(): Promise<AcademyBillingExclusionState> {
  const data = await request();
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("課金対象外設定の応答を確認できませんでした。");
  const value = data as Record<string, unknown>;
  if (value.version !== 1 || value.adminHandle !== "ayumi" || !Array.isArray(value.headquarters) || !Array.isArray(value.exclusions)) throw new Error("課金対象外設定の応答を確認できませんでした。");
  const headquarters = value.headquarters.map((item) => {
    if (!item || typeof item !== "object") throw new Error("課金対象外設定の応答を確認できませんでした。");
    const row = item as Record<string, unknown>; const id = uuid(row.id); const name = text(row.name, 100);
    if (!id || !name) throw new Error("課金対象外設定の応答を確認できませんでした。");
    return { id, name };
  });
  const exclusions = value.exclusions.map((item) => {
    if (!item || typeof item !== "object") throw new Error("課金対象外設定の応答を確認できませんでした。");
    const row = item as Record<string, unknown>;
    const id = uuid(row.id), headquartersId = uuid(row.headquartersId), headquartersName = text(row.headquartersName, 100), targetHandle = text(row.targetHandle, 30), reason = text(row.reason, 160), effectiveFrom = text(row.effectiveFrom, 40);
    const effectiveUntil = row.effectiveUntil === null ? null : text(row.effectiveUntil, 40);
    if (!id || !headquartersId || !headquartersName || !targetHandle || !reason || !effectiveFrom || (row.effectiveUntil !== null && !effectiveUntil) || typeof row.active !== "boolean") throw new Error("課金対象外設定の応答を確認できませんでした。");
    return { id, headquartersId, headquartersName, targetHandle, reason, effectiveFrom, effectiveUntil, active: row.active };
  });
  return { version: 1, adminHandle: "ayumi", headquarters, exclusions };
}

export async function grantAcademyBillingExclusion(input: { headquartersId: string; targetHandle: string; reason: string; effectiveUntil: string | null }) {
  await request({ method: "POST", body: JSON.stringify({ action: "grant", ...input }) });
}

export async function revokeAcademyBillingExclusion(exclusionId: string, reason: string) {
  await request({ method: "POST", body: JSON.stringify({ action: "revoke", exclusionId, reason }) });
}
