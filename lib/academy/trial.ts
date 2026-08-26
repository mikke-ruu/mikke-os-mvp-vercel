import { supabase } from "@/lib/supabase/client";
import { ACADEMY_PREVIEW_IDS, isAcademyLocalReview } from "@/lib/academy/preview";
import type { AcademyHeadquarters, AcademyHeadquartersAccess, AcademyOnboardingEligibility } from "@/types/database";

export function isAcademyTrialPreview() {
  return (
    process.env.NODE_ENV === "development" &&
    typeof globalThis.location !== "undefined" &&
    new URLSearchParams(globalThis.location.search).get("preview") === "trial"
  );
}

export async function getAcademyOnboardingEligibility(): Promise<AcademyOnboardingEligibility> {
  if (isAcademyLocalReview()) {
    return { trial_available: true, paid_creation_available: false, trial_block_reason: null };
  }
  const { data, error } = await supabase.rpc("academy_get_my_onboarding_eligibility");
  if (error) throw error;
  return ((data ?? [])[0] ?? {
    trial_available: false,
    paid_creation_available: false,
    trial_block_reason: "authentication_required"
  }) as AcademyOnboardingEligibility;
}

export async function startAcademySevenDayTrial(name: string) {
  const { data, error } = await supabase.rpc("academy_start_seven_day_trial", { p_name: name });
  if (error) throw error;
  return data as AcademyHeadquarters;
}

export async function getMyAcademyHeadquartersAccess(
  headquartersId: string
): Promise<AcademyHeadquartersAccess | null> {
  if (isAcademyTrialPreview()) {
    return {
      headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
      access_kind: "trial",
      status: "trialing",
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      days_remaining: 7,
      can_manage_drafts: true,
      can_use_live_features: false
    };
  }
  if (isAcademyLocalReview()) return null;
  const { data, error } = await supabase.rpc("academy_get_my_headquarters_access", {
    p_headquarters_id: headquartersId
  });
  if (error) throw error;
  return ((data ?? [])[0] ?? null) as AcademyHeadquartersAccess | null;
}
