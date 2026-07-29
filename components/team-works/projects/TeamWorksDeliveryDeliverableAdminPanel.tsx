"use client";

import { useCallback, useEffect, useState } from "react";
import { Package, Plus } from "lucide-react";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { supabase } from "@/lib/supabase/client";
import { projectDeliverableStatusLabels, type ProjectDeliverableStatus } from "@/lib/team-works-projects";
import {
  addDeliverableComment,
  createDeliverableAsStaff,
  createSignedDeliverableUrl,
  fetchTaskDeliverables,
  updateDeliverableAsStaff,
  type DeliveryDeliverable
} from "@/lib/team-works-delivery-deliverables";
import type { DeliveryTask } from "@/lib/team-works-delivery";
import { teamWorksProjectInputClass } from "./TeamWorksProjectsShell";

const deliverableStatuses = Object.keys(projectDeliverableStatusLabels) as ProjectDeliverableStatus[];

// 本部staff向け。成果物テーブルへのINSERT/UPDATEはstaffがRLSを全てバイパスできるため、
// ステータス変更・クライアント公開・差し戻し理由の記録をここでまとめて行える。
// ただしファイルのアップロードは割り当てられたworkerしか行えない(P8-gのstorage RLS)ため、
// 直接登録はURL形式に限る。
export function TeamWorksDeliveryDeliverableAdminPanel({ task, myMemberId }: { task: DeliveryTask; myMemberId: string | null }) {
  const [deliverables, setDeliverables] = useState<DeliveryDeliverable[] | undefined>(undefined);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [memoByDeliverable, setMemoByDeliverable] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addingTitle, setAddingTitle] = useState(task.title);
  const [addingUrl, setAddingUrl] = useState("");
  const [adding, setAdding] = useState(false);

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
      setError(loadError instanceof Error ? loadError.message : "成果物を読み込めませんでした。");
    }
  }, [task.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(deliverable: DeliveryDeliverable, status: ProjectDeliverableStatus) {
    setBusyId(deliverable.id);
    setError("");
    try {
      const patch: Parameters<typeof updateDeliverableAsStaff>[2] = { status };
      if (status === "client_review") patch.clientVisible = true;
      if (myMemberId) patch.reviewerMemberId = myMemberId;
      await updateDeliverableAsStaff(supabase, deliverable.id, patch);
      if (status === "revision_requested") {
        const memo = memoByDeliverable[deliverable.id]?.trim();
        if (memo && myMemberId) {
          await addDeliverableComment(supabase, {
            projectId: task.projectId,
            deliverableId: deliverable.id,
            authorMemberId: myMemberId,
            audience: deliverable.clientVisible ? "client" : "internal",
            body: memo
          });
        }
      }
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新できませんでした。");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleClientVisible(deliverable: DeliveryDeliverable) {
    setBusyId(deliverable.id);
    setError("");
    try {
      await updateDeliverableAsStaff(supabase, deliverable.id, { clientVisible: !deliverable.clientVisible });
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新できませんでした。");
    } finally {
      setBusyId(null);
    }
  }

  async function addDeliverable() {
    if (!addingTitle.trim()) return;
    setAdding(true);
    setError("");
    try {
      await createDeliverableAsStaff(supabase, {
        projectId: task.projectId,
        taskId: task.id,
        title: addingTitle,
        type: "url",
        url: addingUrl,
        submittedByMemberId: myMemberId
      });
      setAddingUrl("");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "登録できませんでした。");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
      <p className="flex items-center gap-2 text-xs font-extrabold">
        <Package size={14} /> この工程の成果物
      </p>
      {error ? <p role="alert" className="mt-2 rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}
      {deliverables === undefined ? (
        <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>
      ) : deliverables.length === 0 ? (
        <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">まだ提出はありません。担当者からの提出を待つか、下でURLを直接登録できます。</p>
      ) : (
        <div className="mt-2 space-y-2">
          {deliverables.map((deliverable) => (
            <div key={deliverable.id} className="rounded-lg border border-[var(--mikke-line)] bg-white p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">{deliverable.title}</p>
                <MikkeStatusBadge tone={deliverable.status === "approved" || deliverable.status === "delivered" ? "success" : "primary"}>
                  {projectDeliverableStatusLabels[deliverable.status]}
                </MikkeStatusBadge>
              </div>
              {deliverable.url ? <a href={deliverable.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-bold text-[var(--tw-title)]">リンクを開く</a> : null}
              {signedUrls[deliverable.id] ? <a href={signedUrls[deliverable.id]} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-bold text-[var(--tw-title)]">ファイルを開く</a> : null}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <select
                  value={deliverable.status}
                  disabled={busyId === deliverable.id}
                  onChange={(event) => void changeStatus(deliverable, event.target.value as ProjectDeliverableStatus)}
                  className="rounded-lg border border-[var(--mikke-line)] px-2 py-1.5 text-xs font-bold"
                >
                  {deliverableStatuses.map((status) => <option key={status} value={status}>{projectDeliverableStatusLabels[status]}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs font-bold">
                  <input type="checkbox" checked={deliverable.clientVisible} disabled={busyId === deliverable.id} onChange={() => void toggleClientVisible(deliverable)} />
                  クライアントに公開
                </label>
              </div>
              <textarea
                value={memoByDeliverable[deliverable.id] ?? ""}
                onChange={(event) => setMemoByDeliverable((current) => ({ ...current, [deliverable.id]: event.target.value }))}
                placeholder="差し戻す場合は理由をここに入力してから、上の状態を「修正依頼」に変更してください。"
                rows={2}
                className={`${teamWorksProjectInputClass} mt-2 resize-y`}
              />
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input value={addingTitle} onChange={(event) => setAddingTitle(event.target.value)} placeholder="タイトル" className="rounded-lg border border-[var(--mikke-line)] bg-white px-2 py-1.5 text-xs" />
        <input value={addingUrl} onChange={(event) => setAddingUrl(event.target.value)} placeholder="URL(任意)" className="rounded-lg border border-[var(--mikke-line)] bg-white px-2 py-1.5 text-xs" />
        <button type="button" onClick={() => void addDeliverable()} disabled={adding || !addingTitle.trim()} className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold">
          <Plus size={13} /> 直接登録
        </button>
      </div>
    </div>
  );
}
