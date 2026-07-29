"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { projectFormFieldTypeLabels, type ProjectFormField, type ProjectFormFieldType } from "@/lib/team-works-projects";
import { deliveryFormInputActorLabels, type DeliveryFormInputActor, type DeliveryProjectForm } from "@/lib/team-works-delivery-forms";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "./TeamWorksProjectsShell";

const fieldTypes = Object.keys(projectFormFieldTypeLabels) as ProjectFormFieldType[];
const inputActors = Object.keys(deliveryFormInputActorLabels) as DeliveryFormInputActor[];
const selectFieldTypes: ProjectFormFieldType[] = ["single_select", "multi_select"];

export type DeliveryFormPatch = Partial<{
  name: string;
  inputActor: DeliveryFormInputActor;
  required: boolean;
  clientVisible: boolean;
  editableAfterSubmit: boolean;
  fields: ProjectFormField[];
}>;

function createField(): ProjectFormField {
  return {
    id: (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `field_${Date.now()}_${Math.random()}`),
    type: "short_text",
    label: "",
    description: "",
    placeholder: "",
    required: false,
    options: []
  };
}

// 本部staff向けの工程フォーム編集UI。項目の構成(fields)はローカルで組んでから
// まとめて保存し、記入者・必須・クライアント公開などの設定は変更するたびに
// 即保存する(TaskRowの編集UXに合わせる)。
export function TeamWorksProjectFormBuilder({
  form,
  onUpdate,
  onArchive
}: {
  form: DeliveryProjectForm;
  onUpdate: (patch: DeliveryFormPatch) => Promise<void>;
  onArchive: () => Promise<void>;
}) {
  const [fields, setFields] = useState<ProjectFormField[]>(form.fields);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(fields) !== JSON.stringify(form.fields);

  useEffect(() => setFields(form.fields), [form.fields]);

  async function apply(patch: DeliveryFormPatch) {
    setBusy(true);
    setError("");
    try {
      await onUpdate(patch);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  async function saveFields() {
    setMessage("");
    await apply({ fields });
    setMessage("項目を保存しました。");
  }

  function updateField(index: number, patch: Partial<ProjectFormField>) {
    setFields((current) => current.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)));
  }

  function removeField(index: number) {
    setFields((current) => current.filter((_, fieldIndex) => fieldIndex !== index));
  }

  function moveField(index: number, direction: -1 | 1) {
    setFields((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-[var(--mikke-line)] bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <input
          defaultValue={form.name}
          disabled={busy}
          onBlur={(event) => { if (event.target.value.trim() && event.target.value !== form.name) void apply({ name: event.target.value.trim() }); }}
          className="min-w-0 flex-1 rounded-lg border border-[var(--mikke-line)] px-2 py-1.5 text-sm font-bold"
        />
        <button type="button" onClick={() => void onArchive()} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-[var(--mikke-line)] px-2 py-1.5 text-xs font-bold text-[var(--tw-action)]">
          <Trash2 size={13} /> 削除
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <TeamWorksProjectField label="誰が記入するか">
          <select defaultValue={form.inputActor} disabled={busy} onChange={(event) => void apply({ inputActor: event.target.value as DeliveryFormInputActor })} className={teamWorksProjectInputClass}>
            {inputActors.map((actor) => <option key={actor} value={actor}>{deliveryFormInputActorLabels[actor]}</option>)}
          </select>
        </TeamWorksProjectField>
        <div className="flex flex-wrap items-center gap-4 self-end pb-2 text-xs font-bold">
          <label className="flex items-center gap-2"><input type="checkbox" defaultChecked={form.required} disabled={busy} onChange={(event) => void apply({ required: event.target.checked })} />提出必須</label>
          <label className="flex items-center gap-2"><input type="checkbox" defaultChecked={form.clientVisible} disabled={busy} onChange={(event) => void apply({ clientVisible: event.target.checked })} />クライアントに表示</label>
          <label className="flex items-center gap-2"><input type="checkbox" defaultChecked={form.editableAfterSubmit} disabled={busy} onChange={(event) => void apply({ editableAfterSubmit: event.target.checked })} />提出後も編集可</label>
        </div>
      </div>

      {error ? <p role="alert" className="mt-2 rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}

      <div className="mt-3 space-y-2">
        {fields.length === 0 ? <p className="text-xs font-semibold text-[var(--mikke-muted)]">項目はまだありません。</p> : null}
        {fields.map((field, index) => (
          <FieldRow
            key={field.id}
            field={field}
            canMoveUp={index > 0}
            canMoveDown={index < fields.length - 1}
            onChange={(patch) => updateField(index, patch)}
            onRemove={() => removeField(index)}
            onMoveUp={() => moveField(index, -1)}
            onMoveDown={() => moveField(index, 1)}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setFields((current) => [...current, createField()])} className="inline-flex items-center gap-1 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">
          <Plus size={14} /> 項目を追加
        </button>
        <button type="button" onClick={() => void saveFields()} disabled={busy || !dirty} className="inline-flex items-center gap-1 rounded-lg bg-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">
          <Save size={14} /> 項目を保存
        </button>
        {message && !dirty ? <span className="text-xs font-bold text-[var(--tw-done)]">{message}</span> : null}
      </div>
    </div>
  );
}

function FieldRow({
  field,
  canMoveUp,
  canMoveDown,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown
}: {
  field: ProjectFormField;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (patch: Partial<ProjectFormField>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <select value={field.type} onChange={(event) => onChange({ type: event.target.value as ProjectFormFieldType })} className="rounded-lg border border-[var(--mikke-line)] bg-white px-2 py-1.5 text-xs font-bold">
          {fieldTypes.map((type) => <option key={type} value={type}>{projectFormFieldTypeLabels[type]}</option>)}
        </select>
        <input
          value={field.label}
          onChange={(event) => onChange({ label: event.target.value })}
          placeholder="項目名"
          className="min-w-0 flex-1 rounded-lg border border-[var(--mikke-line)] bg-white px-2 py-1.5 text-sm"
        />
        <label className="flex items-center gap-1.5 text-xs font-bold whitespace-nowrap">
          <input type="checkbox" checked={field.required} onChange={(event) => onChange({ required: event.target.checked })} />必須
        </label>
        <button type="button" onClick={onMoveUp} disabled={!canMoveUp} className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white disabled:opacity-30">
          <ArrowUp size={13} />
        </button>
        <button type="button" onClick={onMoveDown} disabled={!canMoveDown} className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white disabled:opacity-30">
          <ArrowDown size={13} />
        </button>
        <button type="button" onClick={onRemove} className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--tw-action)]">
          <Trash2 size={13} />
        </button>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input
          value={field.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="説明・記入例(任意)"
          className="rounded-lg border border-[var(--mikke-line)] bg-white px-2 py-1.5 text-xs"
        />
        {selectFieldTypes.includes(field.type) ? (
          <input
            value={field.options.join(", ")}
            onChange={(event) => onChange({ options: event.target.value.split(",").map((option) => option.trim()).filter(Boolean) })}
            placeholder="選択肢をカンマ区切りで入力"
            className="rounded-lg border border-[var(--mikke-line)] bg-white px-2 py-1.5 text-xs"
          />
        ) : (
          <input
            value={field.placeholder}
            onChange={(event) => onChange({ placeholder: event.target.value })}
            placeholder="プレースホルダー(任意)"
            className="rounded-lg border border-[var(--mikke-line)] bg-white px-2 py-1.5 text-xs"
          />
        )}
      </div>
    </div>
  );
}
