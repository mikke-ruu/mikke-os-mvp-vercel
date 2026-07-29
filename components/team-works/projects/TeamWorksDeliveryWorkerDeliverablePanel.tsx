"use client";

import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { projectDeliverableStatusLabels } from "@/lib/team-works-projects";
import {
  deliveryDeliverableTypeLabels,
  fetchDeliverableComments,
  fetchMyDeliverable,
  saveMyDeliverable,
  uploadDeliverableFile,
  type DeliverableComment,
  type DeliveryDeliverable,
  type DeliveryDeliverableType
} from "@/lib/team-works-delivery-deliverables";
import type { DeliveryTask } from "@/lib/team-works-delivery";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "./TeamWorksProjectsShell";

// 割り当てられたworker向け。task.submissionTypeが'url'ならURL入力、'file'なら
// アップロード。差し戻された場合はteam_works_project_commentsに記録された
// 理由を表示し、再編集・再提出できる。
export function TeamWorksDeliveryWorkerDeliverablePanel({ projectId, task, memberId }: { projectId: string; task: DeliveryTask; memberId: string }) {
  const [deliverable, setDeliverable] = useState<DeliveryDeliverable | null | undefined>(undefined);
  const [comments, setComments] = useState<DeliverableComment[]>([]);
  const [title, setTitle] = useState(task.title);
  const [url, setUrl] = useState("");
  const [pendingStoragePath, setPendingStoragePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const type: DeliveryDeliverableType = task.submissionType === "url" ? "url" : "file_placeholder";

  const load = useCallback(async () => {
    setError("");
    try {
      const existing = await fetchMyDeliverable(supabase, task.id, memberId);
      setDeliverable(existing);
      if (existing) {
        setTitle(existing.title);
        setUrl(existing.url);
        setComments(existing.status === "revision_requested" ? await fetchDeliverableComments(supabase, existing.id) : []);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "読み込めませんでした。");
    }
  }, [task.id, memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const sourceLocalId = deliverable?.sourceLocalId ?? crypto.randomUUID();
      const { storagePath } = await uploadDeliverableFile(supabase, { projectId, task, deliverableSourceLocalId: sourceLocalId, file });
      setPendingStoragePath(storagePath);
      setMessage(`「${file.name}」を選択しました。提出すると送信されます。`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "アップロードに失敗しました。");
    } finally {
      setUploading(false);
    }
  }

  async function save(submit: boolean) {
    if (!title.trim()) {
      setError("タイトルを入力してください。");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const next = await saveMyDeliverable(supabase, {
        projectId,
        taskId: task.id,
        memberId,
        existing: deliverable ?? null,
        title,
        type,
        url,
        storagePath: pendingStoragePath ?? undefined,
        submit
      });
      setDeliverable(next);
      setPendingStoragePath(null);
      setMessage(submit ? "提出しました。" : "下書きを保存しました。");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  if (deliverable === undefined) return <p className="text-xs font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>;

  const editable = !deliverable || deliverable.status === "draft" || deliverable.status === "revision_requested";
  const latestComment = comments[comments.length - 1];

  return (
    <div className="rounded-xl border border-[var(--mikke-line)] bg-white p-3">
      <p className="text-xs font-extrabold">成果物の提出</p>
      {deliverable ? <p className="mt-1 text-xs font-bold text-[var(--mikke-muted)]">状態: {projectDeliverableStatusLabels[deliverable.status]}</p> : null}
      {latestComment ? (
        <div className="mt-2 rounded-lg bg-[var(--mikke-danger-soft)] p-3 text-sm text-[var(--mikke-danger)]">
          <strong>差し戻し理由</strong>
          <p className="mt-1 leading-6">{latestComment.body}</p>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-2 rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}
      {editable ? (
        <div className="mt-2 space-y-2">
          <TeamWorksProjectField label="タイトル">
            <input value={title} onChange={(event) => setTitle(event.target.value)} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          {type === "url" ? (
            <TeamWorksProjectField label="URL">
              <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" className={teamWorksProjectInputClass} />
            </TeamWorksProjectField>
          ) : (
            <TeamWorksProjectField
              label={deliveryDeliverableTypeLabels.file_placeholder}
              helper={pendingStoragePath ? "ファイルを選択済みです。" : deliverable?.storagePath ? "提出済みのファイルがあります。差し替える場合のみ選び直してください。" : undefined}
            >
              <input type="file" onChange={(event) => void upload(event.target.files?.[0] ?? null)} disabled={uploading} className="mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm" />
            </TeamWorksProjectField>
          )}
          {message ? <p className="text-xs font-bold text-[var(--tw-done)]">{message}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void save(false)} disabled={saving} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">下書き保存</button>
            <button type="button" onClick={() => void save(true)} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)]">
              <Send size={14} /> 提出する
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs font-semibold text-[var(--tw-done)]">確認中です。修正が必要になった場合はここに理由が表示されます。</p>
      )}
    </div>
  );
}
