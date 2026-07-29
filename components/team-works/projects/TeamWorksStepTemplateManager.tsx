"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { supabase } from "@/lib/supabase/client";
import {
  archiveStepTemplate,
  createStepTemplate,
  deliveryTaskSubmissionTypeLabels,
  emptyDeliveryTaskInstruction,
  fetchStepTemplates,
  updateStepTemplate,
  type DeliveryStepTemplate,
  type DeliveryStepTemplateStep,
  type DeliveryTaskInstruction,
  type DeliveryTaskSubmissionType
} from "@/lib/team-works-delivery";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "./TeamWorksProjectsShell";
import { TeamWorksTaskInstructionEditor } from "./TeamWorksTaskInstructionEditor";

const submissionTypeOptions = Object.keys(deliveryTaskSubmissionTypeLabels) as DeliveryTaskSubmissionType[];

let rowKeySeed = 0;
function newRowKey() {
  rowKeySeed += 1;
  return `template_row_${rowKeySeed}`;
}

// 新規作成時にワンクリックで試せる実例。認定講座 個別構築コースの
// 実際の工程構成をそのまま元にしている。
const exampleTemplates: { name: string; description: string; steps: DeliveryStepTemplateStep[] }[] = [
  {
    name: "認定講座 個別構築コース",
    description: "依頼者の技術・経験を、キット・教材・動画・Academy・運営環境まで一緒に形にするコース。",
    steps: [
      { title: "ヒアリング・講座整理", defaultRole: "manager", submissionType: "none", standardDays: 3 },
      { title: "キット作製", defaultRole: "manager", submissionType: "none", standardDays: 5 },
      {
        title: "テキスト・ディプロマ作成",
        defaultRole: "client",
        submissionType: "form",
        needsInternalReview: true,
        needsClientReview: true,
        standardDays: 7,
        instruction: {
          description: "受講生が使う講座テキストとディプロマの原稿",
          purpose: "講師が変わっても同じ内容・同じ品質で講座を届けられるようにするため。",
          method: "本部が用意する記入フォーム",
          checklist: [
            "講座の説明を書く",
            "使う材料を書き出す",
            "作り方の工程を順番に書く",
            "注意点を書く",
            "よくある失敗を書く",
            "本部が確認して整文・写真配置",
            "クライアントが最終確認"
          ],
          outputs: ["講座説明", "材料リスト", "工程", "注意点", "よくある失敗"],
          deliverableNote: "記入フォームの回答(写真がある場合は画像も添付)"
        }
      },
      { title: "写真・動画撮影", defaultRole: "manager", submissionType: "none", standardDays: 3 },
      { title: "画像加工・動画編集", defaultRole: "manager", submissionType: "file", needsInternalReview: true, standardDays: 5 },
      { title: "Academy構築", defaultRole: "manager", submissionType: "none", standardDays: 5 },
      { title: "Community構築(必要な場合のみ)", defaultRole: "manager", submissionType: "none", standardDays: 2 },
      { title: "モニター受講・修正", defaultRole: "client", submissionType: "form", needsClientReview: true, standardDays: 5 },
      { title: "納品・運営開始", defaultRole: "manager", submissionType: "url", needsClientReview: true, standardDays: 2 }
    ]
  }
];

type EditableStep = DeliveryStepTemplateStep & { key: string };

// 業種別の仕事テンプレート(編集可)。生成した工程一覧は、ジェネレーターの
// 「③作業の順番」ステップで読み込んでそのまま使うか、案件ごとに調整できる。
export function TeamWorksStepTemplateManager() {
  const [templates, setTemplates] = useState<DeliveryStepTemplate[] | null>(null);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setTemplates(await fetchStepTemplates(supabase));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "テンプレートを読み込めませんでした。");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--mikke-muted)]">よく使う仕事の流れをテンプレートとして保存しておくと、次の案件からすぐ読み込めます。</p>
        <button type="button" onClick={() => setEditingId("new")} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--tw-action)] px-4 py-2.5 text-sm font-bold text-[var(--tw-on-solid)]">
          <Plus size={16} /> 新規作成
        </button>
      </div>

      {error ? <p role="alert" className="rounded-xl border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}

      {editingId ? (
        <TemplateEditor
          template={editingId === "new" ? null : templates?.find((item) => item.id === editingId) ?? null}
          onClose={() => setEditingId(null)}
          onSaved={async () => {
            setEditingId(null);
            await load();
          }}
        />
      ) : null}

      {templates === null ? (
        <p className="text-xs font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>
      ) : templates.length === 0 ? (
        <MikkeEmptyState title="テンプレートはまだありません" helper="「新規作成」からよく使う工程を登録してください。" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((template) => (
            <article key={template.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
              <p className="text-sm font-extrabold">{template.name}</p>
              {template.description ? <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{template.description}</p> : null}
              <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">{template.steps.length}工程</p>
              <ol className="mt-2 space-y-0.5">
                {template.steps.slice(0, 4).map((step, index) => (
                  <li key={`${template.id}_${index}`} className="truncate text-xs text-[var(--mikke-muted)]">{index + 1}. {step.title}</li>
                ))}
                {template.steps.length > 4 ? <li className="text-xs text-[var(--mikke-muted)]">…他{template.steps.length - 4}件</li> : null}
              </ol>
              <div className="mt-3 flex gap-2 border-t border-[var(--mikke-line-soft)] pt-3">
                <button type="button" onClick={() => setEditingId(template.id)} className="flex-1 rounded-lg border border-[var(--mikke-line)] px-2 py-1.5 text-xs font-bold text-[var(--mikke-muted)]">編集</button>
                <button
                  type="button"
                  onClick={() => void archiveStepTemplate(supabase, template.id).then(load)}
                  className="flex-1 rounded-lg border border-[var(--tw-action)] px-2 py-1.5 text-xs font-bold text-[var(--tw-action)]"
                >
                  アーカイブ
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateEditor({ template, onClose, onSaved }: { template: DeliveryStepTemplate | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [organizationName, setOrganizationName] = useState("");
  const [steps, setSteps] = useState<EditableStep[]>(
    (template?.steps ?? []).map((step) => ({ ...step, key: newRowKey() }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedStepKey, setExpandedStepKey] = useState<string | null>(null);

  function addStep() {
    setSteps((current) => [
      ...current,
      { key: newRowKey(), title: "", defaultRole: null, submissionType: "none", needsInternalReview: false, needsClientReview: false, standardDays: null, assigneeLabel: "", instruction: emptyDeliveryTaskInstruction }
    ]);
  }

  function updateStep(key: string, patch: Partial<EditableStep>) {
    setSteps((current) => current.map((step) => (step.key === key ? { ...step, ...patch } : step)));
  }

  function removeStep(key: string) {
    setSteps((current) => current.filter((step) => step.key !== key));
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const cleanSteps = steps
      .filter((step) => step.title.trim().length > 0)
      .map(({ title, defaultRole, submissionType, needsInternalReview, needsClientReview, standardDays, assigneeLabel, instruction }) => ({
        title: title.trim(),
        defaultRole,
        submissionType,
        needsInternalReview,
        needsClientReview,
        standardDays,
        assigneeLabel: assigneeLabel?.trim() || null,
        instruction: instruction
          ? {
              ...instruction,
              // 追加ボタンで作った未入力の行は保存前に落とす。
              checklist: (instruction.checklist ?? []).map((item) => item.trim()).filter(Boolean),
              outputs: (instruction.outputs ?? []).map((item) => item.trim()).filter(Boolean)
            }
          : undefined
      }));
    try {
      if (template) {
        await updateStepTemplate(supabase, template.id, { name: name.trim(), description, steps: cleanSteps });
      } else {
        await createStepTemplate(supabase, { organizationName, name: name.trim(), description, steps: cleanSteps });
      }
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "テンプレートを保存できませんでした。");
      setSaving(false);
    }
  }

  return (
    <MikkeSection title={template ? "テンプレートを編集" : "新しいテンプレート"} tone="editorial">
      <form onSubmit={submit} className="grid gap-4">
        <TeamWorksProjectField label="テンプレート名" required>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例：認定講座 個別構築コース" className={teamWorksProjectInputClass} />
        </TeamWorksProjectField>
        {!template && steps.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {exampleTemplates.map((example) => (
              <button
                key={example.name}
                type="button"
                onClick={() => {
                  setName(example.name);
                  setDescription(example.description);
                  setSteps(example.steps.map((step) => ({ ...step, key: newRowKey() })));
                }}
                className="rounded-full border border-[var(--mikke-line)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-muted)]"
              >
                例：{example.name} を読み込む
              </button>
            ))}
          </div>
        ) : null}
        {!template ? (
          <TeamWorksProjectField label="組織名" helper="すでに所属組織がある場合は既存組織を使い、この入力は初回セットアップ時だけ使用します。">
            <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="例：株式会社◯◯、◯◯事務所" className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
        ) : null}
        <TeamWorksProjectField label="説明(任意)">
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className={`${teamWorksProjectInputClass} resize-none`} />
        </TeamWorksProjectField>

        <div>
          <p className="mb-2 text-xs font-bold">工程</p>
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div key={step.key} className="rounded-xl border border-[var(--mikke-line)] p-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center text-xs font-extrabold text-[var(--mikke-muted)]">{index + 1}</span>
                  <input value={step.title} onChange={(event) => updateStep(step.key, { title: event.target.value })} placeholder="例：ヒアリング・講座整理" className="min-w-0 flex-1 rounded-lg border border-[var(--mikke-line)] px-2.5 py-2 text-sm" />
                  <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--mikke-line)] disabled:opacity-30"><ChevronUp size={14} /></button>
                  <button type="button" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--mikke-line)] disabled:opacity-30"><ChevronDown size={14} /></button>
                  <button type="button" onClick={() => removeStep(step.key)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--tw-action)] text-[var(--tw-action)]"><Trash2 size={14} /></button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-8 text-[11px] font-bold">
                  <select value={step.defaultRole ?? ""} onChange={(event) => updateStep(step.key, { defaultRole: (event.target.value || null) as EditableStep["defaultRole"] })} className="rounded-lg border border-[var(--mikke-line)] px-2 py-1.5">
                    <option value="">誰がやるか:未設定</option>
                    <option value="manager">本部</option>
                    <option value="worker">担当メンバー</option>
                    <option value="client">クライアント</option>
                  </select>
                  <select value={step.submissionType ?? "none"} onChange={(event) => updateStep(step.key, { submissionType: event.target.value as DeliveryTaskSubmissionType })} className="rounded-lg border border-[var(--mikke-line)] px-2 py-1.5">
                    {submissionTypeOptions.map((type) => <option key={type} value={type}>{deliveryTaskSubmissionTypeLabels[type]}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={step.needsInternalReview ?? false} onChange={(event) => updateStep(step.key, { needsInternalReview: event.target.checked })} />本部確認</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={step.needsClientReview ?? false} onChange={(event) => updateStep(step.key, { needsClientReview: event.target.checked })} />クライアント確認</label>
                  <input
                    type="number"
                    min={1}
                    value={step.standardDays ?? ""}
                    onChange={(event) => updateStep(step.key, { standardDays: event.target.value ? Number(event.target.value) : null })}
                    placeholder="標準日数"
                    className="w-20 rounded-lg border border-[var(--mikke-line)] px-2 py-1.5"
                  />
                  <input
                    value={step.assigneeLabel ?? ""}
                    onChange={(event) => updateStep(step.key, { assigneeLabel: event.target.value })}
                    placeholder="仮の担当名"
                    className="w-32 rounded-lg border border-[var(--mikke-line)] px-2 py-1.5"
                  />
                  <button
                    type="button"
                    onClick={() => setExpandedStepKey((current) => (current === step.key ? null : step.key))}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--mikke-line)] px-2 py-1.5"
                  >
                    作業指示
                    {expandedStepKey === step.key ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
                {expandedStepKey === step.key ? (
                  <div className="mt-2 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
                    <TeamWorksTaskInstructionEditor
                      value={{ ...emptyDeliveryTaskInstruction, ...step.instruction }}
                      onChange={(instruction: DeliveryTaskInstruction) => updateStep(step.key, { instruction })}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <button type="button" onClick={addStep} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-muted)]">
            <Plus size={14} /> 工程を追加
          </button>
        </div>

        {error ? <p role="alert" className="rounded-xl border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-[var(--mikke-line)] px-4 py-2.5 text-sm font-bold text-[var(--mikke-muted)]">キャンセル</button>
          <button type="submit" disabled={saving || !name.trim()} className="flex-1 rounded-lg bg-[var(--tw-action)] px-4 py-2.5 text-sm font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">
            {saving ? "保存しています…" : "保存"}
          </button>
        </div>
      </form>
    </MikkeSection>
  );
}
