import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { AcademyCommunityLinkOption } from "@/lib/academy/community-links";

const serverAuthOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false
} as const;

export class AcademyCommunityClaimStopError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly stoppedCount = 0
  ) {
    super(message);
    this.name = "AcademyCommunityClaimStopError";
  }
}

function getPublicEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey) {
    throw new AcademyCommunityClaimStopError(503, "利用権の停止機能を現在利用できません。時間をおいてもう一度お試しください。");
  }
  return { url, publicKey };
}

function getAdminEnvironment() {
  const { url } = getPublicEnvironment();
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey) {
    throw new AcademyCommunityClaimStopError(503, "利用権の停止機能を現在利用できません。時間をおいてもう一度お試しください。");
  }
  return { url, secretKey };
}

function createRequestUserClient(accessToken: string) {
  const { url, publicKey } = getPublicEnvironment();
  return createClient(url, publicKey, {
    auth: serverAuthOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

function createRequestAdminClient() {
  const { url, secretKey } = getAdminEnvironment();
  return createClient(url, secretKey, { auth: serverAuthOptions });
}

type ClaimRow = {
  user_id: string;
  source_reference: string;
  starts_at: string;
  ends_at: string | null;
};

export async function stopAcademyCommunityClaims(input: {
  accessToken: string;
  headquartersId: string;
  mappingId: string;
}) {
  const userClient = createRequestUserClient(input.accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser(input.accessToken);
  if (userError || !userData.user) {
    throw new AcademyCommunityClaimStopError(401, "ログインを確認できませんでした。もう一度ログインしてください。");
  }
  if (userData.user.is_anonymous) {
    throw new AcademyCommunityClaimStopError(403, "登録済みのアカウントでログインしてください。");
  }

  const { data: optionData, error: optionError } = await userClient.rpc("academy_list_my_community_link_options", {
    p_headquarters_id: input.headquartersId
  });
  if (optionError || !Array.isArray(optionData)) {
    throw new AcademyCommunityClaimStopError(403, "この接続を管理する権限を確認できませんでした。");
  }

  const options = optionData as AcademyCommunityLinkOption[];
  const selectedMapping = options
    .flatMap((community) => community.mappings)
    .find((mapping) => mapping.id === input.mappingId);
  if (!selectedMapping || !selectedMapping.isCurrent) {
    throw new AcademyCommunityClaimStopError(403, "この本部で管理できる現在の接続を確認できませんでした。");
  }
  if (selectedMapping.status !== "active") {
    throw new AcademyCommunityClaimStopError(409, "連携中の接続だけ利用権を停止できます。画面を再読み込みしてください。");
  }

  const adminClient = createRequestAdminClient();
  const { data: claimData, error: claimError } = await adminClient
    .from("community_academy_entitlement_claims")
    .select("user_id,source_reference,starts_at,ends_at")
    .eq("mapping_id", input.mappingId)
    .eq("status", "active");
  if (claimError) {
    throw new AcademyCommunityClaimStopError(502, "停止対象を確認できませんでした。時間をおいてもう一度お試しください。");
  }

  const now = Date.now();
  const claims = ((claimData ?? []) as ClaimRow[]).filter((claim) => (
    claim.ends_at === null || new Date(claim.ends_at).getTime() > now
  ));
  if (claims.length === 0) {
    throw new AcademyCommunityClaimStopError(409, "停止対象の利用権はありません。画面を再読み込みしてください。");
  }

  let stoppedCount = 0;
  for (const claim of claims) {
    const { error } = await adminClient.rpc("community_sync_academy_entitlement", {
      p_mapping_id: input.mappingId,
      p_user_id: claim.user_id,
      p_source_reference: claim.source_reference,
      p_status: "revoked",
      p_starts_at: claim.starts_at,
      p_ends_at: claim.ends_at
    });
    if (error) {
      throw new AcademyCommunityClaimStopError(
        502,
        "一部の利用権を停止できませんでした。画面を再読み込みして、残っている件数を確認してください。",
        stoppedCount
      );
    }
    stoppedCount += 1;
  }

  return { stoppedCount };
}
