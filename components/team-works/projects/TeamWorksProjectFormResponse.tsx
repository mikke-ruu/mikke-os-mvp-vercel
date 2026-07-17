"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Save, Send } from "lucide-react";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { teamWorksProjectInputClass, TeamWorksProjectField } from "./TeamWorksProjectsShell";
import {
  projectFormSubmissionStatusLabels,
  type ProjectFormAnswerValue,
  type ProjectFormField,
  type ProjectFormSubmission
} from "@/lib/team-works-projects";
import { canEditProjectFormSubmission, requiredProjectFormFieldsComplete } from "@/lib/team-works-project-forms";

export type TeamWorksProjectFormResponseView = {
  id: string;
  name: string;
  required: boolean;
  dueOffsetDays: number | null;
  editableAfterSubmit: boolean;
  fields: ProjectFormField[];
  submission: ProjectFormSubmission | null;
};

export function TeamWorksProjectFormResponse({ form, onSave, onSubmit }: {
  form: TeamWorksProjectFormResponseView;
  onSave: (answers: Record<string, ProjectFormAnswerValue>) => void;
  onSubmit: (answers: Record<string, ProjectFormAnswerValue>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, ProjectFormAnswerValue>>(form.submission?.answers ?? {});
  const [message, setMessage] = useState("");
  const editable = canEditProjectFormSubmission(form.submission, form.editableAfterSubmit);
  const complete = requiredProjectFormFieldsComplete(form, answers);

  useEffect(() => setAnswers(form.submission?.answers ?? {}), [form.submission]);

  function update(fieldId: string, value: ProjectFormAnswerValue) {
    setAnswers((current) => ({ ...current, [fieldId]: value }));
    setMessage("");
  }

  return <article className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-bold">{form.name}</h3><p className="mt-1 text-xs text-[var(--mikke-muted)]">{form.required ? "提出必須" : "任意"}{form.dueOffsetDays === null ? "" : `・工程開始から${form.dueOffsetDays}日`}</p></div>{form.submission ? <MikkeStatusBadge tone={form.submission.status === "approved" ? "success" : "primary"} className="px-2 py-1">{projectFormSubmissionStatusLabels[form.submission.status]}</MikkeStatusBadge> : null}</div>
    {form.submission?.reviewMemo ? <div className="mt-3 rounded-lg bg-[var(--mikke-danger-soft)] p-3 text-sm text-[var(--mikke-danger)]"><strong>確認メモ</strong><p className="mt-1 leading-6">{form.submission.reviewMemo}</p></div> : null}
    <div className="mt-4 grid gap-4 sm:grid-cols-2">{form.fields.map((field) => <FormField key={field.id} field={field} value={answers[field.id]} editable={editable} onChange={(value) => update(field.id, value)} />)}</div>
    {form.fields.length === 0 ? <p className="mt-4 text-sm text-[var(--mikke-muted)]">入力項目はまだありません。</p> : null}
    {message ? <p className="mt-3 text-xs font-bold text-[var(--mikke-danger)]">{message}</p> : null}
    <div className="mt-4 flex flex-wrap gap-2">{editable ? <><button type="button" onClick={() => { onSave(answers); setMessage("下書きを保存しました。"); }} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold"><Save size={14} /> 下書き保存</button><button type="button" onClick={() => { if (!complete) { setMessage("必須項目を入力してください。"); return; } onSubmit(answers); setMessage(""); }} disabled={form.fields.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Send size={14} /> 提出する</button></> : <div className="flex items-center gap-2 text-xs font-bold text-[var(--mikke-success)]"><CheckCircle2 size={15} /> {form.submission?.status === "approved" ? "承認済みです" : "確認中です"}</div>}</div>
  </article>;
}

function FormField({ field, value, editable, onChange }: { field: ProjectFormField; value: ProjectFormAnswerValue | undefined; editable: boolean; onChange: (value: ProjectFormAnswerValue) => void }) {
  const label = `${field.label}${field.required ? "*" : ""}`;
  if (field.type === "long_text" || field.type === "table" || field.type === "repeater") return <TeamWorksProjectField label={label} className="sm:col-span-2"><textarea value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} disabled={!editable} rows={4} className={`${teamWorksProjectInputClass} resize-y`} placeholder={field.description || field.placeholder} /></TeamWorksProjectField>;
  if (field.type === "single_select") return <TeamWorksProjectField label={label}><select value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} disabled={!editable} className={teamWorksProjectInputClass}><option value="">選択してください</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></TeamWorksProjectField>;
  if (field.type === "multi_select") { const selected = Array.isArray(value) ? value : []; return <fieldset className="rounded-lg border border-[var(--mikke-line)] p-3"><legend className="px-1 text-xs font-bold">{label}</legend><div className="space-y-2">{field.options.map((option) => <label key={option} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} disabled={!editable} />{option}</label>)}</div></fieldset>; }
  if (["checkbox", "approval"].includes(field.type)) return <label className="flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] p-3 text-sm font-bold"><input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} disabled={!editable} />{label}</label>;
  const type = field.type === "number" || field.type === "currency" ? "number" : field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local" : field.type === "url" || field.type === "file" || field.type === "image" ? "url" : "text";
  return <TeamWorksProjectField label={label}><input type={type} value={typeof value === "number" || typeof value === "string" ? value : ""} onChange={(event) => onChange(type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value)} disabled={!editable} className={teamWorksProjectInputClass} placeholder={field.description || field.placeholder || (["file", "image"].includes(field.type) ? "https://" : "")} /></TeamWorksProjectField>;
}
