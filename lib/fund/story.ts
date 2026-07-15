import { supabase } from "@/lib/supabase/client";

export type FundStoryParticipation = {
  participationId: string;
  projectTitle: string;
  publicFundPath: string;
  publishedAt: string;
};

export async function getFundStoryParticipations(profileHandle: string) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("handle", profileHandle)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return [] as FundStoryParticipation[];

  const { data, error } = await supabase
    .from("fund_public_participations")
    .select("participation_id, project_title, public_fund_path, published_at")
    .eq("supporter_profile_id", profile.id)
    .eq("is_anonymous", false)
    .order("published_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((item) => ({
    participationId: item.participation_id as string,
    projectTitle: item.project_title as string,
    publicFundPath: item.public_fund_path as string,
    publishedAt: item.published_at as string
  })) satisfies FundStoryParticipation[];
}
