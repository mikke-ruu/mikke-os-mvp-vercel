import type { CommunityPlatformPlanKey } from "./types";

export type CommunityPlatformPlanDefinition = {
  key: CommunityPlatformPlanKey;
  name: string;
  monthlyAmountYen: number | null;
  memberLimit: number | null;
  helper: string;
};

export const COMMUNITY_PLATFORM_PLANS: readonly CommunityPlatformPlanDefinition[] = [
  {
    key: "trial",
    name: "Trial",
    monthlyAmountYen: 0,
    memberLimit: 10,
    helper: "30日間、10名までCommunityを試せます。"
  },
  {
    key: "starter",
    name: "Starter",
    monthlyAmountYen: 2_980,
    memberLimit: 50,
    helper: "小規模な教室・サークル・顧客Community向け。"
  },
  {
    key: "standard",
    name: "Standard",
    monthlyAmountYen: 4_980,
    memberLimit: 200,
    helper: "会員制サービスや継続運営するCommunity向け。"
  },
  {
    key: "pro",
    name: "Pro",
    monthlyAmountYen: 9_800,
    memberLimit: 1_000,
    helper: "複数ランクや大人数での運営向け。"
  },
  {
    key: "enterprise",
    name: "Enterprise",
    monthlyAmountYen: null,
    memberLimit: null,
    helper: "1,001名以上。要件に合わせた個別見積です。"
  }
] as const;

export function getCommunityPlatformPlan(key: CommunityPlatformPlanKey | null | undefined) {
  return COMMUNITY_PLATFORM_PLANS.find((plan) => plan.key === key) ?? COMMUNITY_PLATFORM_PLANS[0];
}
