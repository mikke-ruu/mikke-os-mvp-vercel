import { supabase } from "@/lib/supabase/client";

export type AcademyCommunityLinkOption = {
  communityId: string;
  communitySlug: string;
  communityName: string;
  definitions: Array<{ key: string; name: string; description: string | null }>;
  mappings: Array<{
    id: string;
    sourceProductKey: string;
    entitlementKey: string;
    status: "draft" | "active" | "archived";
    isCurrent: boolean;
    activeClaimCount: number;
  }>;
};

export const ACADEMY_COMMUNITY_REVOCATION_NOTICE =
  "Academyから追加されたRoomだけ利用終了します。通常のCommunity会員資格・閲覧範囲・有料契約は変更されません。";

const communityLinkErrorMessages: Array<[string, string]> = [
  [
    "Revoke active Academy claims before changing or archiving this mapping",
    "現在この連携を利用中の方がいるため、先にAcademy側で対象者のCommunity利用権を停止してください。"
  ],
  [
    "Resolve the pending Community payment claim before accepting Academy access",
    "Community会費の確認待ちがあります。Community運営者が申請を処理した後、もう一度お試しください。"
  ],
  [
    "This access is already included with an active Academy benefit",
    "このRoomはAcademyの利用範囲に含まれているため、追加のCommunity会費は不要です。"
  ],
  [
    "Pending Academy access invitation was not found",
    "この招待の期限は終了しました。Academy運営者へ再発行を依頼してください。"
  ]
];

export function getAcademyCommunityLinkErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "";
  return communityLinkErrorMessages.find(([pattern]) => rawMessage.includes(pattern))?.[1]
    ?? "Community連携を保存できませんでした。Academy本部とCommunityの両方の運営権限を確認してください。";
}

export async function listMyAcademyCommunityLinkOptions(headquartersId: string) {
  const { data, error } = await supabase.rpc("academy_list_my_community_link_options", {
    p_headquarters_id: headquartersId
  });
  if (error) throw error;
  return (data ?? []) as AcademyCommunityLinkOption[];
}

export async function saveAcademyCommunityRoomLink(input: {
  headquartersId: string;
  communityId: string;
  sourceProductKey: string;
  entitlementKey: string;
  status: "draft" | "active" | "archived";
}) {
  const { data, error } = await supabase.rpc("academy_upsert_community_room_link", {
    p_headquarters_id: input.headquartersId,
    p_community_id: input.communityId,
    p_source_product_key: input.sourceProductKey,
    p_entitlement_key: input.entitlementKey,
    p_status: input.status
  });
  if (error) throw error;
  return data as string;
}

export async function stopAcademyCommunityClaimAccess(input: {
  headquartersId: string;
  mappingId: string;
}) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) throw new Error("ログインが必要です。");

  const response = await fetch("/academy/api/community-links/revoke", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => null) as {
    stoppedCount?: unknown;
    error?: unknown;
  } | null;
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : "利用権を停止できませんでした。時間をおいてもう一度お試しください。");
  }
  if (typeof payload?.stoppedCount !== "number") {
    throw new Error("停止結果を確認できませんでした。画面を再読み込みしてください。");
  }
  return { stoppedCount: payload.stoppedCount };
}

const safeClaimStopMessages = [
  "ログインが必要です。",
  "ログインを確認できませんでした。",
  "登録済みのアカウントでログインしてください。",
  "この接続を管理する権限を確認できませんでした。",
  "この本部で管理できる現在の接続を確認できませんでした。",
  "連携中の接続だけ利用権を停止できます。",
  "停止対象の利用権はありません。",
  "停止対象を確認できませんでした。",
  "一部の利用権を停止できませんでした。",
  "利用権の停止機能を現在利用できません。",
  "停止結果を確認できませんでした。"
] as const;

export function getAcademyCommunityClaimStopErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return safeClaimStopMessages.some((safeMessage) => message.startsWith(safeMessage))
    ? message
    : "利用権を停止できませんでした。画面を再読み込みして、残っている件数を確認してください。";
}
