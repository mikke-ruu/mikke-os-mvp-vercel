"use client";

import { ArrowLeft, ArrowRight, Check, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import {
  createTeamWorksProjectId,
  useTeamWorksProjectStore,
  type ProjectTemplate
} from "@/lib/team-works-projects";
import { teamWorksTemplate } from "@/lib/team-works";
import {
  generateTeamWorksProjectTemplate,
  getTeamWorksProposedPhaseNames,
  initialTeamWorksGeneratorAnswers,
  teamWorksClientVisibilityLabels,
  teamWorksCompletionLabels,
  teamWorksDeliverableTypeLabels,
  teamWorksJobTypeLabels,
  teamWorksManagementNeedLabels,
  teamWorksStakeholderLabels,
  type TeamWorksClientVisibility,
  type TeamWorksCompletionCondition,
  type TeamWorksDeliverableType,
  type TeamWorksGeneratorAnswers,
  type TeamWorksJobType,
  type TeamWorksManagementNeed,
  type TeamWorksStakeholder
} from "@/lib/team-works-generator";
import { teamWorksProjectInputClass } from "@/components/team-works/projects/TeamWorksProjectsShell";

const stepTitles = [
  "仕事の種類",
  "完了条件",
  "関係者",
  "基本工程",
  "工程で必要な管理",
  "クライアント公開",
  "成果物と納品",
  "報酬と請求"
];

export function TeamWorksTemplateGenerator() {
  const router = useRouter();
  const { templateState, saveTemplateState } = useTeamWorksProjectStore();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<TeamWorksGeneratorAnswers>(initialTeamWorksGeneratorAnswers);
  const generated = useMemo(() => generateTeamWorksProjectTemplate(answers), [answers]);
  const [templateName, setTemplateName] = useState(generated.name);
  const [templateDescription, setTemplateDescription] = useState(generated.description);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof TeamWorksGeneratorAnswers>(key: K, value: TeamWorksGeneratorAnswers[K]) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function next() {
    if (step === 8) {
      setTemplateName(generated.name);
      setTemplateDescription(generated.description);
      setStep(9);
      return;
    }
    setStep((current) => Math.min(9, current + 1));
  }

  function back() {
    setStep((current) => Math.max(1, current - 1));
  }

  function reset() {
    setAnswers(initialTeamWorksGeneratorAnswers);
    const initial = generateTeamWorksProjectTemplate(initialTeamWorksGeneratorAnswers);
    setTemplateName(initial.name);
    setTemplateDescription(initial.description);
    setStep(1);
  }

  function saveGenerated(focus?: "phases" | "roles") {
    if (!templateName.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    const template: ProjectTemplate = {
      ...generated,
      id: createTeamWorksProjectId("team_works_project_template"),
      organizationId: teamWorksTemplate.organizationId,
      name: templateName.trim(),
      description: templateDescription.trim(),
      status: "draft",
      currentVersionId: null,
      createdAt: now,
      updatedAt: now
    };
    saveTemplateState({
      ...templateState,
      templates: [template, ...templateState.templates]
    });
    router.push(`/apps/team-works/project-templates/${template.id}${focus ? `?focus=${focus}` : ""}`);
  }

  if (step === 9) {
    return (
      <GeneratorPreview
        generated={generated}
        templateName={templateName}
        templateDescription={templateDescription}
        onNameChange={setTemplateName}
        onDescriptionChange={setTemplateDescription}
        onCreate={() => saveGenerated()}
        onEditPhases={() => saveGenerated("phases")}
        onEditRoles={() => saveGenerated("roles")}
        onEditFeatures={() => setStep(5)}
        onReset={reset}
        saving={saving}
      />
    );
  }

  const canContinue =
    (step !== 2 || answers.completionConditions.length > 0) &&
    (step !== 3 || answers.stakeholders.length > 0) &&
    (step !== 6 || answers.clientVisibility.length > 0) &&
    (step !== 7 || !answers.deliverables.enabled || answers.deliverables.types.length > 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3 text-xs font-bold text-[var(--mikke-muted)]">
          <span>STEP {step} / 8</span>
          <span>{stepTitles[step - 1]}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--mikke-line)]">
          <div className="h-full rounded-full bg-[var(--mikke-accent)] transition-all" style={{ width: `${(step / 8) * 100}%` }} />
        </div>
      </div>

      <MikkeSection title={stepTitles[step - 1]}>
        {step === 1 ? (
          <SingleChoice<TeamWorksJobType>
            label="この仕事はどの形に近いですか？"
            value={answers.jobType}
            options={teamWorksJobTypeLabels}
            onChange={(jobType) => update("jobType", jobType)}
          />
        ) : null}

        {step === 2 ? (
          <MultiChoice<TeamWorksCompletionCondition>
            label="この仕事は、何をもって完了になりますか？"
            values={answers.completionConditions}
            options={teamWorksCompletionLabels}
            onChange={(completionConditions) => update("completionConditions", completionConditions)}
          />
        ) : null}

        {step === 3 ? (
          <MultiChoice<TeamWorksStakeholder>
            label="この仕事には誰が関わりますか？"
            values={answers.stakeholders}
            options={teamWorksStakeholderLabels}
            onChange={(stakeholders) => update("stakeholders", stakeholders)}
          />
        ) : null}

        {step === 4 ? (
          <div>
            <QuestionLabel>回答に近い汎用工程を提案します</QuestionLabel>
            <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">
              特定業種の手順ではなく、仕事の形に共通する下書きです。次のビルダーで名称・順番・条件を編集できます。
            </p>
            <ol className="mt-5 grid gap-2 sm:grid-cols-2">
              {getTeamWorksProposedPhaseNames(answers.jobType).map((phase, index) => (
                <li key={phase} className="flex items-center gap-3 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-bg)] px-3 py-3 text-sm font-bold">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--mikke-primary)] text-xs text-white">{index + 1}</span>
                  {phase}
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {step === 5 ? (
          <MultiChoice<TeamWorksManagementNeed>
            label="各工程でどのような管理が必要ですか？"
            values={answers.managementNeeds}
            options={teamWorksManagementNeedLabels}
            onChange={(managementNeeds) => update("managementNeeds", managementNeeds)}
          />
        ) : null}

        {step === 6 ? (
          <MultiChoice<TeamWorksClientVisibility>
            label="クライアントにも進捗を見せますか？"
            values={answers.clientVisibility}
            options={teamWorksClientVisibilityLabels}
            onChange={(values, changed) => {
              if (changed === "none") {
                update("clientVisibility", values.includes("none") ? ["none"] : []);
                return;
              }
              update("clientVisibility", values.filter((value) => value !== "none"));
            }}
          />
        ) : null}

        {step === 7 ? (
          <DeliverableStep answers={answers} setAnswers={setAnswers} />
        ) : null}

        {step === 8 ? (
          <div className="space-y-3">
            <QuestionLabel>既存の報酬・請求機能を使いますか？</QuestionLabel>
            <ToggleCard
              checked={answers.payouts}
              label="担当者の報酬計算を使う"
              note="計算方式の詳細は後続フェーズで設定します。"
              onChange={(payouts) => update("payouts", payouts)}
            />
            <ToggleCard
              checked={answers.invoices}
              label="クライアント請求を使う"
              note="分割・一括などの詳細は後続フェーズで設定します。"
              onChange={(invoices) => update("invoices", invoices)}
            />
          </div>
        ) : null}
      </MikkeSection>

      <div className="mt-5 flex flex-wrap justify-between gap-3">
        <button
          type="button"
          onClick={back}
          disabled={step === 1}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-4 py-2.5 text-sm font-bold disabled:opacity-40"
        >
          <ArrowLeft size={16} /> 戻る
        </button>
        <button
          type="button"
          onClick={next}
          disabled={!canContinue}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {step === 8 ? "下書きを確認" : "次へ"} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function DeliverableStep({
  answers,
  setAnswers
}: {
  answers: TeamWorksGeneratorAnswers;
  setAnswers: React.Dispatch<React.SetStateAction<TeamWorksGeneratorAnswers>>;
}) {
  function updateDeliverables(patch: Partial<TeamWorksGeneratorAnswers["deliverables"]>) {
    setAnswers((current) => ({
      ...current,
      deliverables: { ...current.deliverables, ...patch }
    }));
  }

  return (
    <div className="space-y-4">
      <ToggleCard
        checked={answers.deliverables.enabled}
        label="成果物・納品物がある"
        note="OFFの場合は成果物の種類と確認設定を使いません。"
        onChange={(enabled) => updateDeliverables({ enabled })}
      />
      {answers.deliverables.enabled ? (
        <>
          <MultiChoice<TeamWorksDeliverableType>
            label="成果物の種類を選んでください"
            values={answers.deliverables.types}
            options={teamWorksDeliverableTypeLabels}
            onChange={(types) => updateDeliverables({ types })}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["internalReview", "内部確認が必要"],
              ["clientReview", "クライアント確認が必要"],
              ["approval", "承認が必要"],
              ["trackRevisions", "修正回数を管理"],
              ["deliveredStatus", "納品済み状態を持つ"]
            ] as const).map(([key, label]) => (
              <ToggleCard
                key={key}
                checked={answers.deliverables[key]}
                label={label}
                onChange={(checked) => updateDeliverables({ [key]: checked })}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function GeneratorPreview({
  generated,
  templateName,
  templateDescription,
  onNameChange,
  onDescriptionChange,
  onCreate,
  onEditPhases,
  onEditRoles,
  onEditFeatures,
  onReset,
  saving
}: {
  generated: ReturnType<typeof generateTeamWorksProjectTemplate>;
  templateName: string;
  templateDescription: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCreate: () => void;
  onEditPhases: () => void;
  onEditRoles: () => void;
  onEditFeatures: () => void;
  onReset: () => void;
  saving: boolean;
}) {
  const enabledFeatures = Object.entries(generated.featureSettings).filter(([, enabled]) => enabled).map(([feature]) => ({
    clientPortal: "クライアント共有",
    deliverables: "成果物",
    comments: "コメント",
    payouts: "報酬",
    invoices: "請求"
  })[feature]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="rounded-xl border border-[var(--mikke-accent)] bg-[var(--mikke-bg)] p-5">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-[var(--mikke-primary)]"><Sparkles size={18} /> 下書きができました</p>
        <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">保存後も、工程・役割・タスク・使用機能を自由に編集できます。</p>
      </div>

      <MikkeSection title="テンプレート情報">
        <label className="block text-xs font-bold">
          テンプレート名
          <input value={templateName} onChange={(event) => onNameChange(event.target.value)} className={teamWorksProjectInputClass} />
        </label>
        <label className="mt-4 block text-xs font-bold">
          説明
          <textarea value={templateDescription} onChange={(event) => onDescriptionChange(event.target.value)} rows={3} className={`${teamWorksProjectInputClass} resize-none`} />
        </label>
      </MikkeSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <MikkeSection title="基本工程">
          <ol className="space-y-2">
            {generated.phases.map((phase, index) => (
              <li key={phase.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm">
                <span><strong className="mr-2 text-[var(--mikke-muted)]">{index + 1}</strong>{phase.name}</span>
                <span className="text-xs text-[var(--mikke-muted)]">{phase.weight}%</span>
              </li>
            ))}
          </ol>
        </MikkeSection>
        <div className="space-y-4">
          <MikkeSection title="関係者と役割">
            <div className="flex flex-wrap gap-2">
              {generated.roleNames.map((role) => <span key={role} className="rounded-full bg-[var(--mikke-bg)] px-3 py-1.5 text-xs font-bold">{role}</span>)}
            </div>
          </MikkeSection>
          <MikkeSection title="使用する機能">
            {enabledFeatures.length > 0 ? (
              <div className="flex flex-wrap gap-2">{enabledFeatures.map((feature) => <span key={feature} className="rounded-full bg-[var(--mikke-bg)] px-3 py-1.5 text-xs font-bold">{feature}</span>)}</div>
            ) : <p className="text-sm text-[var(--mikke-muted)]">追加機能は使いません。</p>}
          </MikkeSection>
          <MikkeSection title="生成内容">
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div><dt className="text-xs text-[var(--mikke-muted)]">工程</dt><dd className="mt-1 text-xl font-bold">{generated.phases.length}</dd></div>
              <div><dt className="text-xs text-[var(--mikke-muted)]">タスク枠</dt><dd className="mt-1 text-xl font-bold">{generated.tasks.length}</dd></div>
              <div><dt className="text-xs text-[var(--mikke-muted)]">フォーム枠</dt><dd className="mt-1 text-xl font-bold">{generated.forms.length}</dd></div>
            </dl>
          </MikkeSection>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={onEditPhases} disabled={saving || !templateName.trim()} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2.5 text-sm font-bold disabled:opacity-40">工程を編集</button>
        <button type="button" onClick={onEditRoles} disabled={saving || !templateName.trim()} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2.5 text-sm font-bold disabled:opacity-40">役割を編集</button>
        <button type="button" onClick={onEditFeatures} disabled={saving} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2.5 text-sm font-bold disabled:opacity-40">使用機能を変更</button>
        <button type="button" onClick={onReset} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2.5 text-sm font-bold disabled:opacity-40"><RotateCcw size={15} /> 最初から</button>
      </div>
      <button type="button" onClick={onCreate} disabled={saving || !templateName.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
        <Check size={17} /> {saving ? "保存しています…" : "この内容で作成"}
      </button>
    </div>
  );
}

function QuestionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-base font-bold leading-7">{children}</p>;
}

function SingleChoice<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-base font-bold leading-7">{label}</legend>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {(Object.entries(options) as [T, string][]).map(([key, text]) => (
          <label key={key} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-semibold ${value === key ? "border-[var(--mikke-accent)] bg-[var(--mikke-bg)]" : "border-[var(--mikke-line)]"}`}>
            <input type="radio" name={label} value={key} checked={value === key} onChange={() => onChange(key)} />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function MultiChoice<T extends string>({
  label,
  values,
  options,
  onChange
}: {
  label: string;
  values: T[];
  options: Record<T, string>;
  onChange: (values: T[], changed: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-base font-bold leading-7">{label}</legend>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {(Object.entries(options) as [T, string][]).map(([key, text]) => {
          const checked = values.includes(key);
          return (
            <label key={key} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-semibold ${checked ? "border-[var(--mikke-accent)] bg-[var(--mikke-bg)]" : "border-[var(--mikke-line)]"}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const next = checked ? values.filter((value) => value !== key) : [...values, key];
                  onChange(next, key);
                }}
              />
              {text}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ToggleCard({ checked, label, note, onChange }: { checked: boolean; label: string; note?: string; onChange: (checked: boolean) => void }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${checked ? "border-[var(--mikke-accent)] bg-[var(--mikke-bg)]" : "border-[var(--mikke-line)]"}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1" />
      <span>
        <span className="block text-sm font-bold">{label}</span>
        {note ? <span className="mt-1 block text-xs leading-5 text-[var(--mikke-muted)]">{note}</span> : null}
      </span>
    </label>
  );
}
