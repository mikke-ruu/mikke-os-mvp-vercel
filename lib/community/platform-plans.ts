// Approved operator prices: 2026-08-26 pricing audit; PR #40 ba9f4d7.
// Display catalogue only. The billing server owns prices and eligibility.
export const COMMUNITY_PLATFORM_CATALOG_VERSION = "community-platform-2026-08-26";
export type CommunityPlatformPlanKey = "trial" | "starter" | "standard" | "pro" | "enterprise";
export type CommunityPlatformPlan = Readonly<{
  key: CommunityPlatformPlanKey;
  name: string;
  monthlyAmountYen: number | null;
  memberLimit: number | null;
  trialDays: number | null;
}>;

export const COMMUNITY_PLATFORM_PLANS: readonly CommunityPlatformPlan[] = Object.freeze([
  Object.freeze({ key: "trial", name: "30日間お試し", monthlyAmountYen: 0, memberLimit: 10, trialDays: 30 }),
  Object.freeze({ key: "starter", name: "Starter", monthlyAmountYen: 2980, memberLimit: 50, trialDays: null }),
  Object.freeze({ key: "standard", name: "Standard", monthlyAmountYen: 4980, memberLimit: 200, trialDays: null }),
  Object.freeze({ key: "pro", name: "Pro", monthlyAmountYen: 9800, memberLimit: 1000, trialDays: null }),
  Object.freeze({ key: "enterprise", name: "Enterprise", monthlyAmountYen: null, memberLimit: null, trialDays: null })
]);

export function getCommunityPlatformPlan(key: unknown): CommunityPlatformPlan | null {
  // Unknown / missing contracts must not silently become a free trial.
  return COMMUNITY_PLATFORM_PLANS.find((plan) => plan.key === key) ?? null;
}

export function communityPlatformPriceLabel(plan: CommunityPlatformPlan): string {
  if (plan.key === "enterprise") return "個別見積";
  if (plan.key === "trial") return "30日間 0円";
  return `月額${plan.monthlyAmountYen!.toLocaleString("ja-JP")}円（税込）`;
}
