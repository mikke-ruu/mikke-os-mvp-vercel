import "server-only";

import { createClient } from "@supabase/supabase-js";

const serverAuthOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false
} as const;

export type CommunityAcademyReleaseOverview = {
  community: { id: string; slug: string; name: string; status: "active" };
  contract:
    | { kind: "unavailable" }
    | {
        kind: "available";
        status: string;
        currentPeriodStartsAt: string;
        currentPeriodEndsAt: string;
        writeAllowed: boolean;
      };
  activeMemberCount: number;
  invitationCount: number;
  invitationsTruncated: boolean;
  invitations: Array<{
    id: string;
    instructorId: string;
    status: "pending" | "accepted" | "declined" | "cancelled" | "revoked" | "expired";
    roomIds: string[];
    createdAt: string;
    expiresAt: string;
    acceptedAt: string | null;
    cancelledAt: string | null;
    declinedAt: string | null;
    revokedAt: string | null;
  }>;
};

export type CommunityAcademyInvitationResult = {
  id: string;
  status: "pending";
  reused: boolean;
};

export class CommunityAcademyAccessError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "CommunityAcademyAccessError";
  }
}

function getPublicEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey) {
    throw new CommunityAcademyAccessError(503, "Community連携を現在利用できません。時間をおいてもう一度お試しください。");
  }
  return { url, publicKey };
}

function createRequestUserClient(accessToken: string) {
  const { url, publicKey } = getPublicEnvironment();
  return createClient(url, publicKey, {
    auth: serverAuthOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

async function authenticatedClient(accessToken: string) {
  const client = createRequestUserClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new CommunityAcademyAccessError(401, "ログインを確認できませんでした。もう一度ログインしてください。");
  }
  if (data.user.is_anonymous) {
    throw new CommunityAcademyAccessError(403, "登録済みのアカウントでログインしてください。");
  }
  return client;
}

function rpcError(error: { code?: string; message?: string } | null) {
  if (!error) return new CommunityAcademyAccessError(502, "Community連携の状態を確認できませんでした。");
  if (error.code === "42501") {
    return new CommunityAcademyAccessError(403, "Academy本部とCommunityの管理権限を確認できませんでした。");
  }
  if (error.code === "55000" && error.message?.includes("policy")) {
    return new CommunityAcademyAccessError(409, "講師招待の適用条件はまだ確定していません。");
  }
  if (error.code === "55000") {
    return new CommunityAcademyAccessError(409, "最新のCommunity連携状態を確認してください。");
  }
  if (error.code === "23505") {
    return new CommunityAcademyAccessError(409, "同じ講師への招待がすでにあります。");
  }
  return new CommunityAcademyAccessError(502, "Community連携を処理できませんでした。時間をおいてもう一度お試しください。");
}

export async function readCommunityAcademyReleaseOverview(input: {
  accessToken: string;
  headquartersId: string;
  communityId: string;
}) {
  const client = await authenticatedClient(input.accessToken);
  const { data, error } = await client.rpc("academy_get_community_release_overview", {
    p_headquarters_id: input.headquartersId,
    p_community_id: input.communityId
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw rpcError(error);
  return data as unknown as CommunityAcademyReleaseOverview;
}

export async function issueCommunityAcademyInstructorInvitation(input: {
  accessToken: string;
  headquartersId: string;
  communityId: string;
  mappingId: string;
  instructorId: string;
  roomIds: string[];
  policyKey: string;
}) {
  const client = await authenticatedClient(input.accessToken);
  const { data, error } = await client.rpc("academy_issue_community_instructor_invitation", {
    p_headquarters_id: input.headquartersId,
    p_community_id: input.communityId,
    p_mapping_id: input.mappingId,
    p_instructor_id: input.instructorId,
    p_room_ids: input.roomIds,
    p_policy_key: input.policyKey
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw rpcError(error);
  return data as unknown as CommunityAcademyInvitationResult;
}

export async function cancelCommunityAcademyInstructorInvitation(input: {
  accessToken: string;
  headquartersId: string;
  communityId: string;
  invitationId: string;
}) {
  const client = await authenticatedClient(input.accessToken);
  const { data, error } = await client.rpc("academy_cancel_community_instructor_invitation", {
    p_headquarters_id: input.headquartersId,
    p_community_id: input.communityId,
    p_invitation_id: input.invitationId
  });
  if (error || typeof data !== "string") throw rpcError(error);
  return data as "cancelled" | "revoked" | "expired" | "declined";
}

export async function declineCommunityAcademyInstructorInvitation(input: {
  accessToken: string;
  invitationId: string;
}) {
  const client = await authenticatedClient(input.accessToken);
  const { data, error } = await client.rpc("community_decline_my_academy_access_invitation", {
    p_invitation_id: input.invitationId
  });
  if (error || typeof data !== "string") throw rpcError(error);
  return data as "declined" | "expired" | "accepted" | "cancelled" | "revoked";
}
