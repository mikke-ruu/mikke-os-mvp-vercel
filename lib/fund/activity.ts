import type { FundChallengeRecord, FundProject, FundSupport } from "./types";
import type { UnifiedActivityLog } from "@/lib/mikkeos/types";

function baseFundActivity(project: FundProject, eventType: string, sourceId: string): UnifiedActivityLog {
  const now = new Date().toISOString();
  return {
    id: `fund-${eventType}-${sourceId}`,
    profileId: "profile-ayumi",
    appKey: "fund",
    eventType,
    title: project.title,
    occurredAt: now,
    amountType: "none",
    sourceId,
    visibility: "private",
    storyEnabled: false,
    deskEnabled: false,
    countsTowardSummary: false,
    metadata: {
      category: "production",
      sourceLabel: "Fund"
    },
    createdAt: now
  };
}

export function createFundPublishedActivity(project: FundProject) {
  return {
    ...baseFundActivity(project, "fund_project_published", project.id),
    title: `${project.title}を公開`,
    description: project.shortDescription
  };
}

export function createFundSupportActivity(project: FundProject, support: FundSupport) {
  return {
    ...baseFundActivity(project, "fund_support_recorded", support.id),
    title: `${project.title}に応援を登録`,
    description: "応援を1件登録しました。応援者情報と金額は公開されません。"
  };
}

export function createFundPaymentActivity(project: FundProject, support: FundSupport) {
  return {
    ...baseFundActivity(project, "fund_payment_confirmed", support.id),
    title: `${project.title}の支払いを確認`,
    description: "実行者が外部サービスの支払いを確認しました。",
    amount: support.amount ?? undefined,
    amountType: support.amount == null ? "none" as const : "income" as const,
    deskEnabled: support.amount != null,
    metadata: {
      category: "production",
      sourceLabel: "Fund支払い確認",
      deskGroup: "Fund応援",
      paymentStatus: support.amount == null ? "not_required" as const : "paid" as const
    }
  };
}

export function createFundFulfillmentActivity(project: FundProject, support: FundSupport) {
  return {
    ...baseFundActivity(project, "fund_fulfillment_completed", support.id),
    title: `${project.title}の提供を完了`,
    description: "応援プランの提供を1件完了しました。個人情報は含みません。"
  };
}

export function createFundCompletedActivity(project: FundProject, record: FundChallengeRecord) {
  const storyEnabled = record.visibility === "public" && record.storyEnabled;
  return {
    ...baseFundActivity(project, "fund_project_completed", project.id),
    title: record.title,
    description: record.summary,
    occurredAt: record.completedAt,
    visibility: storyEnabled ? "public" as const : "private" as const,
    storyEnabled,
    countsTowardSummary: storyEnabled,
    metadata: {
      category: "production",
      sourceLabel: "Fund",
      storySection: "挑戦の軌跡",
      publicPath: `/fund/${project.profileSlug}/${project.slug}`
    }
  };
}
