import type { CommunityAcademyReleaseOverview } from "@/lib/community/academy-access-admin";

export type CommunityInvitationOption = {
  mappingId: string;
  policyKey: string;
  rooms: Array<{ id: string; name: string }>;
};
export type CommunityInvitationChoices<T> = {
  state: "available" | "unavailable";
  reason: null | "academy_access_unavailable" | "academy_invitation_stopped" | "community_access_unavailable" | "policy_unavailable" | "no_mapping";
  items: T[];
};
export type AcademyCommunityOverviewData = CommunityAcademyReleaseOverview & {
  invitationOptions: CommunityInvitationChoices<CommunityInvitationOption>;
  instructorCandidates: CommunityInvitationChoices<{ instructorId: string; displayName: string }>;
};
export type CommunityInvitation = AcademyCommunityOverviewData["invitations"][number];
export type CommunityInvitationCommand =
  | { action: "issue"; headquartersId: string; communityId: string; mappingId: string; instructorId: string; roomIds: string[]; policyKey: string }
  | { action: "cancel"; headquartersId: string; communityId: string; invitationId: string };

const statuses = ["pending", "accepted", "declined", "cancelled", "revoked", "expired"];
const invalid = () => new Error("Communityの情報を確認できませんでした。再読み込みしてください。");
export function parseCommunityOverview(value: unknown): AcademyCommunityOverviewData {
  if (!value || typeof value !== "object") throw invalid();
  const v = value as AcademyCommunityOverviewData;
  if (!v.community || typeof v.community.id !== "string" || typeof v.community.name !== "string"
    || !v.contract || !["available", "unavailable"].includes(v.contract.kind)
    || !Number.isSafeInteger(v.activeMemberCount) || v.activeMemberCount < 0
    || !Number.isSafeInteger(v.invitationCount) || v.invitationCount < 0
    || typeof v.invitationsTruncated !== "boolean" || !Array.isArray(v.invitations)
    || v.invitations.some(i => !i || typeof i.id !== "string" || typeof i.instructorId !== "string" || !statuses.includes(i.status) || !Array.isArray(i.roomIds) || !Number.isFinite(Date.parse(i.createdAt)) || !Number.isFinite(Date.parse(i.expiresAt)))) throw invalid();
  if (v.contract.kind === "available" && (typeof v.contract.status !== "string" || typeof v.contract.writeAllowed !== "boolean" || !Number.isFinite(Date.parse(v.contract.currentPeriodEndsAt)))) throw invalid();
  const validChoices = (choice: unknown): choice is CommunityInvitationChoices<unknown> => {
    if (!choice || typeof choice !== "object") return false;
    const c = choice as CommunityInvitationChoices<unknown>;
    return ["available", "unavailable"].includes(c.state) && [null, "academy_access_unavailable", "academy_invitation_stopped", "community_access_unavailable", "policy_unavailable", "no_mapping"].includes(c.reason)
      && Array.isArray(c.items) && (c.state === "available" ? c.reason === null : c.items.length === 0);
  };
  if (!validChoices(v.invitationOptions) || v.invitationOptions.items.some(o => !o || typeof o.mappingId !== "string" || typeof o.policyKey !== "string" || !Array.isArray(o.rooms) || !o.rooms.length || o.rooms.some(r => !r || typeof r.id !== "string" || typeof r.name !== "string"))) throw invalid();
  if (!validChoices(v.instructorCandidates) || v.instructorCandidates.items.some(i => !i || typeof i.instructorId !== "string" || typeof i.displayName !== "string")) throw invalid();
  return v;
}

export function instructorInvitationState(data: AcademyCommunityOverviewData, instructorId: string, now = Date.now()) {
  const invitations = data.invitations.filter(i => i.instructorId === instructorId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const current = invitations.find(i => i.status === "accepted" || (i.status === "pending" && Date.parse(i.expiresAt) > now)) ?? invitations[0];
  if (!current) return { label: data.invitationsTruncated ? "履歴を確認できません" : "未招待", invitation: null };
  const label = { pending: Date.parse(current.expiresAt) <= now ? "招待期限切れ" : "招待中", accepted: "承諾済み", declined: "辞退", cancelled: "取消済み", revoked: "利用終了", expired: "招待期限切れ" }[current.status];
  return { label, invitation: current };
}

export function createCommunityAccessClient(accessToken: string, request: typeof fetch = fetch) {
  async function send(url: string, init: RequestInit = {}) {
    if (!accessToken) throw new Error("ログインが必要です。");
    const response = await request(url, { ...init, cache: "no-store", credentials: "same-origin", headers: { Authorization: `Bearer ${accessToken}`, ...(init.body ? { "Content-Type": "application/json" } : {}) } });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok !== true) throw new Error(typeof payload?.error === "string" ? payload.error : "Community連携を処理できませんでした。最新の状態を確認してください。");
    return payload;
  }
  return {
    async read(headquartersId: string, communityId: string, signal?: AbortSignal) {
      const payload = await send(`/community/api/academy-access?${new URLSearchParams({ headquartersId, communityId })}`, { signal });
      const data = parseCommunityOverview(payload.overview);
      if (data.community.id !== communityId) throw invalid();
      return data;
    },
    async mutate(command: CommunityInvitationCommand, signal?: AbortSignal) {
      const payload = await send("/community/api/academy-access", { method: "POST", body: JSON.stringify(command), signal });
      if (command.action === "issue") {
        if (typeof payload.invitation?.id !== "string" || payload.invitation.status !== "pending") throw invalid();
        return payload.invitation.id as string;
      }
      if (!["cancelled", "revoked", "expired", "declined"].includes(payload.status)) throw invalid();
      return payload.status as string;
    }
  };
}
