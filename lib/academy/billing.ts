import { supabase } from "@/lib/supabase/client";
import { isAcademyLocalReview } from "@/lib/academy/preview";

export type AcademyBillingSnapshot = {
  headquarters_id: string;
  snapshot_month: string;
  cutoff_at: string;
  captured_at: string;
  registered_instructor_count: number;
  catalog_price_yen: number;
  charge_month: string;
  charge_price_yen: number;
  price_notice_required: boolean;
  pricing_rule_version: string;
};

export type AcademyCurrentBillingEstimate = {
  registered_instructor_count: number;
  catalog_price_yen: number;
  observed_at: string;
};

export async function getMyAcademyCurrentBillingEstimate(headquartersId: string) {
  if (isAcademyLocalReview()) {
    return {
      registered_instructor_count: 21,
      catalog_price_yen: 10_000,
      observed_at: "2026-08-30T03:00:00.000Z",
    } satisfies AcademyCurrentBillingEstimate;
  }
  const { data, error } = await supabase.rpc("academy_get_my_current_billing_estimate", {
    p_headquarters_id: headquartersId,
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return null;
    throw error;
  }
  return ((data as AcademyCurrentBillingEstimate[] | null) ?? [])[0] ?? null;
}

export async function getMyAcademyBillingSnapshot(headquartersId: string) {
  if (isAcademyLocalReview()) {
    return {
      headquarters_id: headquartersId,
      snapshot_month: "2026-08-01",
      cutoff_at: "2026-08-31T15:00:00.000Z",
      captured_at: "2026-08-31T15:05:00.000Z",
      registered_instructor_count: 21,
      catalog_price_yen: 10_000,
      charge_month: "2026-09-01",
      charge_price_yen: 5_000,
      price_notice_required: true,
      pricing_rule_version: "academy_early_access_v1",
    } satisfies AcademyBillingSnapshot;
  }

  const { data, error } = await supabase.rpc("academy_get_my_billing_snapshot", {
    p_headquarters_id: headquartersId,
    p_snapshot_month: null,
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return null;
    throw error;
  }
  return ((data as AcademyBillingSnapshot[] | null) ?? [])[0] ?? null;
}
