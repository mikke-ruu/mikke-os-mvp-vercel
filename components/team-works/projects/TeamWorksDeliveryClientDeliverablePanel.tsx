"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, MessageSquareWarning } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { projectDeliverableStatusLabels } from "@/lib/team-works-projects";
import {
  addDeliverableComment,
  createSignedDeliverableUrl,
  fetchTaskDeliverables,
  reviewDeliverableAsClient,
  type DeliveryDeliverable
} from "@/lib/team-works-delivery-deliverables";
import type { DeliveryTask } from "@/lib/team-works-delivery";
import { teamWorksProjectInputClass } from "./TeamWorksProjectsShell";

// クライアント向け。RLSはclient_visibleかつclient_review/revision_requested/
// approved/deliveredの成果物しか返さないので、そのまま一覧表示すればよい。
// 承認/修正依頼はclient_reviewの時だけ、の2択に限定する(RLSと一致させる)。
export function TeamWorksDeliveryClientDeliverablePanel({ projectId, task, memberId }: { projectId: string; task: DeliveryTask; memberId: string }) {
  const [deliverables, setDeliverables] = useState<DeliveryDeliverable[] | undefined>(undefined);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [memoByDeliverable, setMemoByDeliverable] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const rows = await fetchTaskDeliverables(supabase, task.id);
      setDeliverables(rows);
      const entries = await Promise.all(
        rows
          .filter((row) => row.deliverableType === "file_placeholder" && row.storagePath)
          .map(async (row) => [row.id, await createSignedDeliverableUrl(supabase, row.storagePath as string)] as const)
      );
      setSignedUrls(Object.fromEntries(entries.filter((entry): entry is [string, string] => Boolean(entry[1]))));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "読み込めませんでした。");
    }
  }, [task.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function respond(deliverable: DeliveryDeliverable, nextStatus: "approved" | "revision_requested") {
    if (nextStatus === "revision_requested" && !memoByDeliverable[deliverable.id]?.trim()) {
      setError("修正を依頼する場合は理由を入力してください。");
      return;
    }
    setBusyId(deliverable.id);
    setError("");
    try {
      if (nextStatus === "revision_requested") {
        await addDeliverableComment(supabase, {
          projectId,
          deliverableId: deliverable.id,
          authorMemberId: memberId,
          audience: "client",
          body: memoByDeliverable[deliverable.id]
        });
      }
      await reviewDeliverableAsClient(supabase, { deliverableId: deliverable.id, memberId, nextStatus });
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "更新できませんでした。");
    } finally {
      setBusyId(null);
    }
  }

  if (deliverables === undefined) return <p className="text-xs font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>;
  if (deliverables.length === 0) return null;

  return (
    <div className="space-y-2">
      {error ? <p role="alert" className="rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}
      {deliverables.map((deliverable) => (
        <div key={deliverable.id} className="rounded-xl border border-[var(--mikke-line)] bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold">{deliverable.title}</p>
            <span className="rounded-full border border-[var(--mikke-line)] px-2 py-1 text-[11px] font-bold text-[var(--mikke-muted)]">
              {projectDeliverableStatusLabels[deliverable.status]}
            </span>
          </div>
          {deliverable.url ? <a href={deliverable.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-bold text-[var(--tw-title)]">内容を見る</a> : null}
          {signedUrls[deliverable.id] ? <a href={signedUrls[deliverable.id]} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-bold text-[var(--tw-title)]">ファイルを見る</a> : null}
          {deliverable.status === "client_review" ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={memoByDeliverable[deliverable.id] ?? ""}
                onChange={(event) => setMemoByDeliverable((current) => ({ ...current, [deliverable.id]: event.target.value }))}
                placeholder="修正を依頼する場合は理由を入力してください"
                rows={2}
                className={`${teamWorksProjectInputClass} resize-y`}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busyId === deliverable.id} onClick={() => void respond(deliverable, "approved")} className="inline-flex items-center gap-1 rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)]">
                  <CheckCircle2 size={14} /> 承認する
                </button>
                <button type="button" disabled={busyId === deliverable.id} onClick={() => void respond(deliverable, "revision_requested")} className="inline-flex items-center gap-1 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">
                  <MessageSquareWarning size={14} /> 修正を依頼する
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
