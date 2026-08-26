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
  }>;
};

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
