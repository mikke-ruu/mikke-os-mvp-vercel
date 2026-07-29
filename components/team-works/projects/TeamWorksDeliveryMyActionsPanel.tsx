"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowRight, MessageSquareWarning } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { DeliveryProjectDetail, DeliveryProjectMember } from "@/lib/team-works-delivery";
import { fetchProjectForms, fetchSubmissionsByFormIds } from "@/lib/team-works-delivery-forms";
import { fetchProjectDeliverables } from "@/lib/team-works-delivery-deliverables";
import { buildMyDeliveryActionItems, type DeliveryActionItem } from "@/lib/team-works-delivery-summary";

// Phase 5: ポータルを開いた瞬間に「自分が今すぐ対応すべきこと」が分かる状態にする。
// task.owner_role と、紐づくsubmission/deliverableの状態から導出するだけで、
// 新しい状態列は追加していない。
export function TeamWorksDeliveryMyActionsPanel({ detail, myMembership }: { detail: DeliveryProjectDetail; myMembership: DeliveryProjectMember }) {
  const [items, setItems] = useState<DeliveryActionItem[] | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const forms = await fetchProjectForms(supabase, detail.project.id);
      const [submissions, deliverables] = await Promise.all([
        fetchSubmissionsByFormIds(supabase, forms),
        fetchProjectDeliverables(supabase, detail.project.id)
      ]);
      setItems(buildMyDeliveryActionItems({ tasks: detail.tasks, forms, submissions, deliverables, myMembership }));
    } catch {
      setItems([]);
    }
  }, [detail, myMembership]);

  useEffect(() => {
    void load();
  }, [load]);

  const completedCount = detail.tasks.filter((task) => task.status === "completed").length;

  if (items === undefined) return null;

  return (
    <div className="space-y-2">
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <a
              key={`${item.kind}-${item.taskId}-${item.urgency}`}
              href={`#task-${item.taskId}`}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                item.urgency === "revision" ? "border-[var(--tw-action)] bg-[var(--mikke-danger-soft)]" : "border-[var(--mikke-line)] bg-white"
              }`}
            >
              {item.urgency === "revision" ? (
                <MessageSquareWarning size={18} className="shrink-0 text-[var(--tw-action)]" />
              ) : (
                <AlertCircle size={18} className="shrink-0 text-[var(--tw-action)]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{item.detail}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-[var(--mikke-muted)]">
                  {item.taskTitle}
                  {item.dueOn ? `・期日 ${item.dueOn}` : ""}
                </p>
              </div>
              <ArrowRight size={16} className="shrink-0 text-[var(--mikke-muted)]" />
            </a>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-[var(--mikke-line)] bg-white p-3 text-sm font-semibold text-[var(--tw-done)]">今すぐ対応することはありません。</p>
      )}
      <p className="text-xs font-bold text-[var(--mikke-muted)]">
        進捗 {detail.tasks.length}工程中{completedCount}件完了
        {detail.project.dueOn ? `・納品予定 ${detail.project.dueOn}` : ""}
      </p>
    </div>
  );
}
