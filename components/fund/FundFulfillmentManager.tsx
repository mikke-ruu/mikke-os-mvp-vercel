"use client";

import { useAuth } from "@/components/AuthGate";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { createFundFulfillmentActivity } from "@/lib/fund/activity";
import { notifyFundDatabaseUpdated, saveFundSupport } from "@/lib/fund/database";
import { fundFulfillmentStatusLabels, type FundFulfillmentStatus, type FundPlan, type FundProject, type FundSupport } from "@/lib/fund/types";
import { useUnifiedActivityLogs } from "@/lib/mikkeos/activity-client-store";
import { useState } from "react";

const statuses = Object.keys(fundFulfillmentStatusLabels) as FundFulfillmentStatus[];

export function FundFulfillmentManager({
  project,
  plans,
  supports
}: {
  project: FundProject;
  plans: FundPlan[];
  supports: FundSupport[];
}) {
  const { profile } = useAuth();
  const { addLog, removeLog } = useUnifiedActivityLogs();
  const [supportAction, setSupportAction] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const projectSupports = supports.filter(
    (support) =>
      support.projectId === project.id &&
      support.recordStatus === "valid" &&
      support.paymentStatus !== "refunded" &&
      support.paymentStatus !== "cancelled"
  );
  const planTitle = (planId: string) => plans.find((plan) => plan.id === planId)?.title ?? "プラン指定なし";

  async function changeStatus(supportId: string, status: FundFulfillmentStatus) {
    const support = projectSupports.find((item) => item.id === supportId);
    if (!support) return;
    const nextSupport = { ...support, fulfillmentStatus: status, updatedAt: new Date().toISOString() };
    setSupportAction(supportId);
    setSaveError("");
    try {
      await saveFundSupport({ ownerProfileId: profile.id, projectId: project.id, support: nextSupport });
      if (status === "completed") {
        addLog(createFundFulfillmentActivity(project, nextSupport));
      } else {
        removeLog("fund", supportId, "fund_fulfillment_completed");
      }
      notifyFundDatabaseUpdated(profile.id);
    } catch {
      setSaveError("提供状況を保存できませんでした。もう一度お試しください。");
    } finally {
      setSupportAction(null);
    }
  }

  if (projectSupports.length === 0) return <MikkeEmptyState title="提供対象はまだありません" helper="応援者を登録すると、ここで提供状況を管理できます。" />;

  return <div className="mx-auto max-w-3xl">{saveError ? <p className="mb-3 text-xs font-semibold text-[var(--mikke-danger)]">{saveError}</p> : null}<div className="divide-y divide-[var(--mikke-line)]">{projectSupports.map((support) => (
    <section key={support.id} className="py-4 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-bold">{support.supporterName}</h2><p className="mt-1 text-xs text-[var(--mikke-muted)]">{planTitle(support.planId)}・数量 {support.quantity}</p></div><MikkeStatusBadge tone={support.fulfillmentStatus === "completed" ? "success" : "muted"} className="px-2 py-1">{fundFulfillmentStatusLabels[support.fulfillmentStatus]}</MikkeStatusBadge></div>
      <label className="mt-3 block text-xs font-bold">提供状況
        <select value={support.fulfillmentStatus} onChange={(event) => void changeStatus(support.id, event.target.value as FundFulfillmentStatus)} disabled={supportAction === support.id} className="mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm outline-none disabled:opacity-45">
          {statuses.map((status) => <option key={status} value={status}>{fundFulfillmentStatusLabels[status]}</option>)}
        </select>
      </label>
    </section>
  ))}</div></div>;
}
