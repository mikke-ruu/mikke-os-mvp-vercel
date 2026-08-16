import { supabase } from "@/lib/supabase/client";
import type {
  AcademyHeadquartersInvitation,
  AcademyHeadquartersMember,
  AcademyHeadquartersRole,
  AcademyHeadquartersSettings
} from "@/types/database";

const memberSelect =
  "*, member:profiles!academy_headquarters_members_member_profile_id_fkey(id,display_name,handle)";
const invitationSelect =
  "*, headquarters:academy_headquarters(id,name,handle), target:profiles!academy_headquarters_invitations_target_profile_id_fkey(id,display_name,handle)";

export async function getHeadquartersSettings(headquartersId: string) {
  const { data, error } = await supabase
    .from("academy_headquarters_settings")
    .select("*")
    .eq("headquarters_id", headquartersId)
    .maybeSingle();
  if (error) throw error;
  return data as AcademyHeadquartersSettings | null;
}

export async function saveHeadquartersSettings(
  headquartersId: string,
  featureFlags: Record<string, boolean>,
  userId: string
) {
  const { data, error } = await supabase
    .from("academy_headquarters_settings")
    .upsert({
      headquarters_id: headquartersId,
      feature_flags: featureFlags,
      updated_by_user_id: userId,
      updated_at: new Date().toISOString()
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as AcademyHeadquartersSettings;
}

export async function getMyHeadquartersRole(headquartersId: string) {
  const { data, error } = await supabase.rpc("academy_get_my_headquarters_role", {
    p_headquarters_id: headquartersId
  });
  if (error) throw error;
  return data as AcademyHeadquartersRole | null;
}

export async function listHeadquartersMembers(headquartersId: string) {
  const { data, error } = await supabase
    .from("academy_headquarters_members")
    .select(memberSelect)
    .eq("headquarters_id", headquartersId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AcademyHeadquartersMember[];
}

export async function listHeadquartersInvitations(headquartersId: string) {
  const { data, error } = await supabase
    .from("academy_headquarters_invitations")
    .select(invitationSelect)
    .eq("headquarters_id", headquartersId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AcademyHeadquartersInvitation[];
}

export async function listMyHeadquartersInvitations(profileId: string) {
  const { data, error } = await supabase
    .from("academy_headquarters_invitations")
    .select(invitationSelect)
    .eq("target_profile_id", profileId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AcademyHeadquartersInvitation[];
}

export async function inviteHeadquartersMember(
  headquartersId: string,
  mikkeId: string,
  role: Exclude<AcademyHeadquartersRole, "owner">
) {
  const { data, error } = await supabase.rpc("academy_invite_headquarters_member", {
    p_headquarters_id: headquartersId,
    p_mikke_id: mikkeId.trim().replace(/^@/, ""),
    p_role: role
  });
  if (error) throw error;
  return data as AcademyHeadquartersInvitation;
}

export async function respondHeadquartersInvitation(
  invitationId: string,
  response: "accepted" | "declined"
) {
  const { data, error } = await supabase.rpc("academy_respond_headquarters_invitation", {
    p_invitation_id: invitationId,
    p_response: response
  });
  if (error) throw error;
  return data as AcademyHeadquartersInvitation;
}

export async function stopHeadquartersMember(memberId: string) {
  const { data, error } = await supabase.rpc("academy_stop_headquarters_member", {
    p_member_id: memberId
  });
  if (error) throw error;
  return data as AcademyHeadquartersMember;
}

