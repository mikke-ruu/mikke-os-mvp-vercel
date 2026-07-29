"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { DeliveryProjectDetail } from "@/lib/team-works-delivery";
import { fetchProjectForms, fetchSubmissionsByFormIds } from "@/lib/team-works-delivery-forms";
import { fetchProjectDeliverables } from "@/lib/team-works-delivery-deliverables";
import { buildStaffPendingSummary, type DeliveryStaffPendingSummary } from "@/lib/team-works-delivery-summary";

// Phase 5: 本部ダッシュボード。「クライアント待ち／本部確認待ち／期限超過」の
// 件数と、誰待ちかの一覧をプロジェクト詳細の最上部に出す。
export function TeamWorksDeliveryStaffPendingSummary({ detail }: { detail: DeliveryProjectDetail }) {
  const [summary, setSummary] = useState<DeliveryStaffPendingSummary | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const forms = await fetchProjectForms(supabase, detail.project.id);
      const [submissions, deliverables] = await Promise.all([
        fetchSubmissionsByFormIds(supabase, forms),
        fetchProjectDeliverables(supabase, detail.project.id)
      ]);
      setSummary(buildStaffPendingSummary({ tasks: detail.tasks, forms, submissions, deliverables }));
    } catch {
      setSummary({ clientWaitingCount: 0, staffReviewCount: 0, overdueCount: 0, items: [] });
    }
  }, [detail]);

  useEffect(() => {
    void load();
  }, [load]);

  if (summary === undefined) return null;

  return (
    <div className="mb-3 space-y-2 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
      <div className="flex flex-wrap gap-4 text-xs font-bold">
        <span>クライアント待ち <span className="text-sm text-[var(--tw-deadline)]">{summary.clientWaitingCount}</span>件</span>
        <span>本部確認待ち <span className="text-sm text-[var(--tw-title)]">{summary.staffReviewCount}</span>件</span>
        <span>期限超過 <span className="text-sm text-[var(--tw-action)]">{summary.overdueCount}</span>件</span>
      </div>
      {summary.items.length > 0 ? (
        <div className="space-y-1.5">
          {summary.items.map((item) => (
            <a key={`${item.kind}-${item.taskId}-${item.urgency}-${item.detail}`} href={`#task-${item.taskId}`} className="flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] bg-white px-2.5 py-1.5 text-xs font-semibold">
              <span className="min-w-0 flex-1 truncate">{item.detail}{item.dueOn ? `・期日 ${item.dueOn}` : ""}</span>
              <ArrowRight size={13} className="shrink-0 text-[var(--mikke-muted)]" />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
