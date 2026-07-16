import { supabase } from "@/lib/supabase/client";
import type { FundProject, FundSupport } from "./types";

export type FundParticipation = {
  id: string;
  project_id: string;
  support_id: string;
  owner_user_id: string;
  supporter_user_id: string;
  supporter_profile_id: string;
  owner_consent_status: "pending" | "granted" | "revoked";
  supporter_consent_status: "pending" | "granted" | "revoked";
  public_name: string | null;
  display_mode: "hidden" | "public_name" | "anonymous";
  created_at: string;
  updated_at: string;
};

export type FundSupportIdentityStatus = {
  sourceLocalId: string;
  activeClaim: {
    id: string;
    expiresAt: string;
  } | null;
  participation: {
    id: string;
    ownerConsentStatus: FundParticipation["owner_consent_status"];
    supporterConsentStatus: FundParticipation["supporter_consent_status"];
    displayMode: FundParticipation["display_mode"];
  } | null;
};

export async function acceptFundSupportClaim(token: string) {
  const { data, error } = await supabase.rpc("accept_fund_support_claim", { p_token: token });
  if (error) throw error;
  return data as string;
}

export async function getMyFundParticipations() {
  const { data, error } = await supabase
    .from("fund_participations")
    .select("id, project_id, support_id, owner_user_id, supporter_user_id, supporter_profile_id, owner_consent_status, supporter_consent_status, public_name, display_mode, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FundParticipation[];
}

export async function getMyFundParticipation(participationId: string) {
  const { data, error } = await supabase
    .from("fund_participations")
    .select("id, project_id, support_id, owner_user_id, supporter_user_id, supporter_profile_id, owner_consent_status, supporter_consent_status, public_name, display_mode, created_at, updated_at")
    .eq("id", participationId)
    .maybeSingle();
  if (error) throw error;
  return data as FundParticipation | null;
}

export async function updateMyFundParticipationConsent(input: {
  participationId: string;
  supporterConsentStatus: FundParticipation["supporter_consent_status"];
  publicName: string;
  displayMode: FundParticipation["display_mode"];
}) {
  const { error } = await supabase.rpc("update_fund_participation_consent", {
    p_participation_id: input.participationId,
    p_supporter_consent_status: input.supporterConsentStatus,
    p_public_name: input.publicName,
    p_display_mode: input.displayMode
  });
  if (error) throw error;
}

export async function updateOwnerFundParticipationConsent(input: {
  participationId: string;
  ownerConsentStatus: FundParticipation["owner_consent_status"];
}) {
  const { error } = await supabase.rpc("update_fund_participation_consent", {
    p_participation_id: input.participationId,
    p_owner_consent_status: input.ownerConsentStatus
  });
  if (error) throw error;
}

export async function getFundSupportIdentityStatuses(sourceLocalIds: string[]) {
  if (sourceLocalIds.length === 0) return [] as FundSupportIdentityStatus[];

  const { data: supports, error: supportsError } = await supabase
    .from("fund_supports")
    .select("id, source_local_id")
    .in("source_local_id", sourceLocalIds);
  if (supportsError) throw supportsError;
  if (!supports?.length) return [] as FundSupportIdentityStatus[];

  const supportIds = supports.map((support) => support.id as string);
  const [{ data: claims, error: claimsError }, { data: participations, error: participationsError }] = await Promise.all([
    supabase
      .from("fund_support_claims")
      .select("id, support_id, expires_at")
      .in("support_id", supportIds)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString()),
    supabase
      .from("fund_participations")
      .select("id, support_id, owner_consent_status, supporter_consent_status, display_mode")
      .in("support_id", supportIds)
  ]);
  if (claimsError) throw claimsError;
  if (participationsError) throw participationsError;

  return supports.map((support) => {
    const claim = claims?.find((item) => item.support_id === support.id);
    const participation = participations?.find((item) => item.support_id === support.id);
    return {
      sourceLocalId: support.source_local_id as string,
      activeClaim: claim ? { id: claim.id as string, expiresAt: claim.expires_at as string } : null,
      participation: participation ? {
        id: participation.id as string,
        ownerConsentStatus: participation.owner_consent_status as FundParticipation["owner_consent_status"],
        supporterConsentStatus: participation.supporter_consent_status as FundParticipation["supporter_consent_status"],
        displayMode: participation.display_mode as FundParticipation["display_mode"]
      } : null
    };
  }) satisfies FundSupportIdentityStatus[];
}

export async function revokeFundSupportInvite(claimId: string) {
  const { error } = await supabase.rpc("revoke_fund_support_claim", { p_claim_id: claimId });
  if (error) throw error;
}

type FundIdentityOwner = {
  userId: string;
  profileId: string;
};

async function getFundProjectForIdentity(project: FundProject, owner: FundIdentityOwner) {
  const { data, error } = await supabase
    .from("fund_projects")
    .select("id")
    .eq("owner_user_id", owner.userId)
    .eq("owner_profile_id", owner.profileId)
    .eq("source_local_id", project.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Fundを先に保存してから、Mikke IDの招待を作成してください。");
  return data.id as string;
}

async function getFundSupportForIdentity(projectId: string, support: FundSupport) {
  const { data, error } = await supabase
    .from("fund_supports")
    .select("id")
    .eq("project_id", projectId)
    .eq("source_local_id", support.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("応援記録を先に保存してから、Mikke IDの招待を作成してください。");
  return data.id as string;
}

export async function createFundSupportInvite(input: {
  project: FundProject;
  support: FundSupport;
  owner: FundIdentityOwner;
  expiresInDays?: number;
}) {
  const projectId = await getFundProjectForIdentity(input.project, input.owner);
  const supportId = await getFundSupportForIdentity(projectId, input.support);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + Math.min(Math.max(input.expiresInDays ?? 14, 1), 30));

  const { data, error } = await supabase.rpc("create_fund_support_claim", {
    p_support_id: supportId,
    p_expires_at: expiresAt.toISOString()
  });
  if (error) throw error;

  const claim = Array.isArray(data) ? data[0] : data;
  if (!claim?.invite_token || !claim?.expires_at) throw new Error("招待トークンを作成できませんでした。");
  return { claimId: claim.claim_id as string, inviteToken: claim.invite_token as string, expiresAt: claim.expires_at as string };
}
