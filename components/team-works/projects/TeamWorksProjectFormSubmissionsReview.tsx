"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, MessageSquareWarning } from "lucide-react";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { supabase } from "@/lib/supabase/client";
import { projectFormSubmissionStatusLabels, type ProjectFormAnswerValue, type ProjectFormSubmission } from "@/lib/team-works-projects";
import { isProjectFormAttachmentAnswer } from "@/lib/team-works-project-forms";
import { fetchFormSubmissions, reviewFormSubmission, type DeliveryProjectForm } from "@/lib/team-works-delivery-forms";
import type { DeliveryProjectMember } from "@/lib/team-works-delivery";
import { teamWorksProjectInputClass } from "./TeamWorksProjectsShell";

// 本部staff向け。提出された回答を確認し、承認/差し戻し(理由必須)の2択に限定する。
export function TeamWorksProjectFormSubmissionsReview({
  form,
  members,
  myMemberId
}: {
  form: DeliveryProjectForm;
  members: DeliveryProjectMember[];
  myMemberId: string | null;
}) {
  const [submissions, setSubmissions] = useState<ProjectFormSubmission[] | undefined>(undefined);
  const [error, setError] = useState("");
  const [memoBySubmission, setMemoBySubmission] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setSubmissions(await fetchFormSubmissions(supabase, form));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "提出を読み込めませんでした。");
    }
  }, [form]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(submission: ProjectFormSubmission, nextStatus: "approved" | "revision_requested") {
    if (!myMemberId) {
      setError("本部メンバーとしてこのプロジェクトに参加してから審査してください。");
      return;
    }
    if (nextStatus === "revision_requested" && !memoBySubmission[submission.id]?.trim()) {
      setError("差し戻す場合は理由を入力してください。");
      return;
    }
    setBusyId(submission.id);
    setError("");
    try {
      await reviewFormSubmission(supabase, {
        formId: form.id,
        submittedByMemberId: submission.submittedById,
        reviewerMemberId: myMemberId,
        nextStatus,
        reviewMemo: memoBySubmission[submission.id] ?? ""
      });
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "更新できませんでした。");
    } finally {
      setBusyId(null);
    }
  }

  if (submissions === undefined) return <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">提出を読み込んでいます…</p>;
  if (submissions.length === 0) return <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">まだ提出はありません。</p>;

  return (
    <div className="mt-2 space-y-2">
      {error ? <p role="alert" className="rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}
      {submissions.map((submission) => {
        const submitterName = members.find((member) => member.organizationMemberId === submission.submittedById)?.displayName ?? "メンバー";
        return (
          <div key={submission.id} className="rounded-lg border border-[var(--mikke-line)] bg-white p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-extrabold">{submitterName}</p>
              <MikkeStatusBadge tone={submission.status === "approved" ? "success" : "primary"}>{projectFormSubmissionStatusLabels[submission.status]}</MikkeStatusBadge>
            </div>
            {form.fields.length > 0 ? (
              <dl className="mt-2 space-y-1.5">
                {form.fields.map((field) => (
                  <div key={field.id} className="text-xs">
                    <dt className="font-bold text-[var(--mikke-muted)]">{field.label || "(項目名未設定)"}</dt>
                    <dd className="mt-0.5">{formatAnswer(submission.answers[field.id])}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {submission.status === "submitted" ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={memoBySubmission[submission.id] ?? ""}
                  onChange={(event) => setMemoBySubmission((current) => ({ ...current, [submission.id]: event.target.value }))}
                  placeholder="差し戻す場合は理由を入力してください"
                  rows={2}
                  className={`${teamWorksProjectInputClass} resize-y`}
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busyId === submission.id} onClick={() => void review(submission, "approved")} className="inline-flex items-center gap-1 rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)]">
                    <CheckCircle2 size={14} /> 承認する
                  </button>
                  <button type="button" disabled={busyId === submission.id} onClick={() => void review(submission, "revision_requested")} className="inline-flex items-center gap-1 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">
                    <MessageSquareWarning size={14} /> 差し戻す
                  </button>
                </div>
              </div>
            ) : submission.reviewMemo ? (
              <p className="mt-2 text-xs font-semibold text-[var(--tw-action)]">確認メモ: {submission.reviewMemo}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function formatAnswer(value: ProjectFormAnswerValue | undefined): string {
  if (value === undefined || value === null || value === "") return "(未回答)";
  if (Array.isArray(value)) return value.length > 0 ? value.join("、") : "(未回答)";
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  if (isProjectFormAttachmentAnswer(value)) return value.fileName || "添付ファイル";
  return String(value);
}
