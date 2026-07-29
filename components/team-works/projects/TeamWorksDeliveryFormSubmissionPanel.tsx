"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { ProjectFormAnswerValue, ProjectFormSubmission } from "@/lib/team-works-projects";
import { fetchMyFormSubmission, saveMyFormSubmission, uploadMyFormAttachment, type DeliveryProjectForm } from "@/lib/team-works-delivery-forms";
import { TeamWorksProjectFormResponse, type TeamWorksProjectFormResponseView } from "./TeamWorksProjectFormResponse";

// ワーカー/クライアントポータル向け。既存のTeamWorksProjectFormResponse
// (localStorage版の記入UI)をそのまま流用し、保存・提出先だけSupabaseに向ける。
export function TeamWorksDeliveryFormSubmissionPanel({
  projectId,
  form,
  memberId
}: {
  projectId: string;
  form: DeliveryProjectForm;
  memberId: string;
}) {
  const [submission, setSubmission] = useState<ProjectFormSubmission | null | undefined>(undefined);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setSubmission(await fetchMyFormSubmission(supabase, form, memberId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "フォームを読み込めませんでした。");
    }
  }, [form, memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(answers: Record<string, ProjectFormAnswerValue>, submit: boolean) {
    setError("");
    try {
      await saveMyFormSubmission(supabase, { projectId, formId: form.id, memberId, answers, submit });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存できませんでした。");
    }
  }

  if (submission === undefined) return <p className="text-xs font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>;

  const view: TeamWorksProjectFormResponseView = {
    id: form.id,
    name: form.name,
    required: form.required,
    dueOffsetDays: null,
    editableAfterSubmit: form.editableAfterSubmit,
    fields: form.fields,
    submission
  };

  return (
    <div>
      {error ? <p role="alert" className="mb-2 rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}
      <TeamWorksProjectFormResponse
        form={view}
        onSave={(answers) => void save(answers, false)}
        onSubmit={(answers) => void save(answers, true)}
        onUploadAttachment={(field, file) => uploadMyFormAttachment(supabase, { projectId, form, memberId, fieldId: field.id, file })}
      />
    </div>
  );
}
