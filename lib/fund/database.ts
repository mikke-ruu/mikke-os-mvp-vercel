import { supabase } from "@/lib/supabase/client";
import type { FundPlan, FundProject } from "./types";

export async function saveFundProjectContent(input: {
  ownerProfileId: string;
  project: FundProject;
  plans: FundPlan[];
}) {
  const { data, error } = await supabase.rpc("save_fund_project_content", {
    p_owner_profile_id: input.ownerProfileId,
    p_project: input.project,
    p_plans: input.plans
  });
  if (error) throw error;
  return data as string;
}
