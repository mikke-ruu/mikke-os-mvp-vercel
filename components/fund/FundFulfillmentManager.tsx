"use client";

import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { useFundProjects } from "@/lib/fund/store";
import { fundFulfillmentStatusLabels, type FundFulfillmentStatus } from "@/lib/fund/types";

const statuses = Object.keys(fundFulfillmentStatusLabels) as FundFulfillmentStatus[];

export function FundFulfillmentManager({ projectId }: { projectId: string }) {
  const { plans, supports, updateSupport } = useFundProjects();
  const projectSupports = supports.filter(
    (support) =>
      support.projectId === projectId &&
      support.recordStatus === "valid" &&
      support.paymentStatus !== "refunded" &&
      support.paymentStatus !== "cancelled"
  );
  const planTitle = (planId: string) => plans.find((plan) => plan.id === planId)?.title ?? "プラン指定なし";

  if (projectSupports.length === 0) return <MikkeEmptyState title="提供対象はまだありません" helper="応援者を登録すると、ここで提供状況を管理できます。" />;

  return <div className="mx-auto max-w-3xl divide-y divide-[var(--mikke-line)]">{projectSupports.map((support) => (
    <section key={support.id} className="py-4 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-bold">{support.supporterName}</h2><p className="mt-1 text-xs text-[var(--mikke-muted)]">{planTitle(support.planId)}・数量 {support.quantity}</p></div><MikkeStatusBadge tone={support.fulfillmentStatus === "completed" ? "success" : "muted"} className="px-2 py-1">{fundFulfillmentStatusLabels[support.fulfillmentStatus]}</MikkeStatusBadge></div>
      <label className="mt-3 block text-xs font-bold">提供状況
        <select value={support.fulfillmentStatus} onChange={(event) => updateSupport(support.id, { fulfillmentStatus: event.target.value as FundFulfillmentStatus })} className="mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm outline-none">
          {statuses.map((status) => <option key={status} value={status}>{fundFulfillmentStatusLabels[status]}</option>)}
        </select>
      </label>
    </section>
  ))}</div>;
}
