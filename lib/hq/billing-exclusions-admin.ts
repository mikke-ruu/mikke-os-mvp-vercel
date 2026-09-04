import "server-only";

import { createClient } from "@supabase/supabase-js";

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export class BillingExclusionAdminError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "BillingExclusionAdminError";
  }
}

function environment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey) throw new BillingExclusionAdminError(503, "課金対象外設定を現在利用できません。");
  return { url, publicKey };
}

async function actorClient(accessToken: string) {
  const { url, publicKey } = environment();
  const client = createClient(url, publicKey, { auth: authOptions, global: { headers: { Authorization: `Bearer ${accessToken}` } } });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new BillingExclusionAdminError(401, "ログインを確認できませんでした。");
  if (data.user.is_anonymous) throw new BillingExclusionAdminError(403, "登録済みアカウントでログインしてください。");
  return { client, actorUserId: data.user.id };
}

function rpcError(message?: string) {
  if (message?.includes("FORBIDDEN")) return new BillingExclusionAdminError(403, "この画面は @ayumi 専用です。");
  if (message?.includes("ACCOUNT_NOT_FOUND")) return new BillingExclusionAdminError(404, "指定したmikke IDが見つかりません。");
  if (message?.includes("HEADQUARTERS_NOT_FOUND")) return new BillingExclusionAdminError(404, "指定したAcademy本部が見つかりません。");
  if (message?.includes("INVALID_INPUT")) return new BillingExclusionAdminError(400, "入力内容を確認してください。");
  return new BillingExclusionAdminError(409, "課金対象外設定を更新できませんでした。状態を読み直してください。");
}

export async function listAcademyBillingExclusions(accessToken: string) {
  const { client, actorUserId } = await actorClient(accessToken);
  const { data, error } = await client.rpc("mikkeos_academy_billing_exclusion_list" as never, { p_actor_user_id: actorUserId } as never);
  if (error || !data) throw rpcError(error?.message);
  return data;
}

export async function grantAcademyBillingExclusion(accessToken: string, input: { headquartersId: string; targetHandle: string; reason: string; effectiveUntil: string | null }) {
  const { client, actorUserId } = await actorClient(accessToken);
  const { data, error } = await client.rpc("mikkeos_academy_billing_exclusion_grant" as never, {
    p_actor_user_id: actorUserId,
    p_headquarters_id: input.headquartersId,
    p_target_handle: input.targetHandle,
    p_reason: input.reason,
    p_effective_until: input.effectiveUntil
  } as never);
  if (error || !data) throw rpcError(error?.message);
  return data;
}

export async function revokeAcademyBillingExclusion(accessToken: string, input: { exclusionId: string; reason: string }) {
  const { client, actorUserId } = await actorClient(accessToken);
  const { data, error } = await client.rpc("mikkeos_academy_billing_exclusion_revoke" as never, {
    p_actor_user_id: actorUserId,
    p_exclusion_id: input.exclusionId,
    p_reason: input.reason
  } as never);
  if (error || !data) throw rpcError(error?.message);
  return data;
}
