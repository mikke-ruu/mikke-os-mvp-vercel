"use client";

import {
  ArrowDown,
  ArrowUp,
  Archive,
  Check,
  Copy,
  GripVertical,
  History,
  Plus,
  Save,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import {
  createTeamWorksProjectId,
  projectTaskPriorityLabels,
  useTeamWorksProjectStore,
  type ProjectTaskPriority,
  type ProjectTemplate,
  type ProjectTemplateForm,
  type ProjectTemplatePhase,
  type ProjectTemplateTask
} from "@/lib/team-works-projects";
import {
  createTeamWorksTemplateVersion,
  duplicateTeamWorksProjectTemplate,
  overwriteTeamWorksTemplateVersion
} from "@/lib/team-works-project-templates";
import { teamWorksInitialState } from "@/lib/team-works";
import {
  TeamWorksProjectField,
  teamWorksProjectInputClass
} from "@/components/team-works/projects/TeamWorksProjectsShell";

const templateStatusLabels: Record<ProjectTemplate["status"], string> = {
  draft: "下書き",
  active: "利用中",
  archived: "アーカイブ"
};

const priorities = Object.keys(projectTaskPriorityLabels) as ProjectTaskPriority[];

export function TeamWorksTemplateBuilder({ templateId }: { templateId: string }) {
  const router = useRouter();
  const { hydrated, projectState, templateState, saveTemplateState } = useTeamWorksProjectStore();
  const storedTemplate = templateState.templates.find((template) => template.id === templateId);
  const [draftState, setDraft] = useState<ProjectTemplate | null>(null);
  const draft = draftState as ProjectTemplate;
  const [newRoleName, setNewRoleName] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [draggedPhaseId, setDraggedPhaseId] = useState<string | null>(null);

  useEffect(() => {
    if (storedTemplate && !draft) setDraft(structuredClone(storedTemplate));
  }, [storedTemplate, draft]);

  const totalWeight = useMemo(
    () => draft?.phases.reduce((sum, phase) => sum + Math.max(0, phase.weight), 0) ?? 0,
    [draft]
  );
  const versions = templateState.versions.filter((version) => version.templateId === templateId).sort((a, b) => b.version - a.version);
  const currentVersion = versions.find((version) => version.id === draft?.currentVersionId) ?? null;
  const usedProjectCount = projectState.projects.filter((project) => project.templateId === templateId).length;

  function change(next: ProjectTemplate) {
    const standardDurationDays = next.phases.reduce((sum, phase) => sum + Math.max(0, phase.standardDays), 0);
    setDraft({ ...next, standardDurationDays, updatedAt: new Date().toISOString() });
    setSavedMessage("");
    setSaveError(false);
  }

  function save(mode: "overwrite" | "new_version" = "overwrite") {
    if (!draft || !draft.name.trim()) return;
    if (draft.status === "active" && (draft.phases.length === 0 || totalWeight !== 100)) {
      setSavedMessage("利用中にするには、工程を1件以上用意し、比重の合計を100%にしてください。");
      setSaveError(true);
      return;
    }
    const now = new Date().toISOString();
    const saved = { ...draft, name: draft.name.trim(), description: draft.description.trim(), updatedAt: now };
    const hadCurrentVersion = templateState.versions.some((version) => version.id === saved.currentVersionId);
    const versionResult = mode === "new_version"
      ? createTeamWorksTemplateVersion({
          template: saved,
          versions: templateState.versions,
          createdByMemberId: teamWorksInitialState.workers[0]?.id ?? "team_works_owner",
          now,
          createId: createTeamWorksProjectId
        })
      : overwriteTeamWorksTemplateVersion({
          template: saved,
          versions: templateState.versions,
          createdByMemberId: teamWorksInitialState.workers[0]?.id ?? "team_works_owner",
          now,
          createId: createTeamWorksProjectId
        });
    saveTemplateState({
      templates: templateState.templates.map((template) => template.id === saved.id ? versionResult.template : template),
      versions: versionResult.versions
    });
    setDraft(versionResult.template);
    const saveKind = mode === "new_version"
      ? "新しい版として保存"
      : hadCurrentVersion
        ? "上書き保存"
        : "初回バージョンとして保存";
    setSavedMessage(`Ver.${versionResult.version.version}を${saveKind}しました。`);
    setSaveError(false);
  }

  function duplicateTemplate() {
    const now = new Date().toISOString();
    const copy = duplicateTeamWorksProjectTemplate({ template: draft, now, createId: createTeamWorksProjectId });
    saveTemplateState({
      ...templateState,
      templates: [copy, ...templateState.templates]
    });
    router.push(`/apps/team-works/project-templates/${copy.id}`);
  }

  function archiveTemplate() {
    const now = new Date().toISOString();
    const archived = { ...draft, status: "archived" as const, updatedAt: now };
    saveTemplateState({
      ...templateState,
      templates: templateState.templates.map((template) => template.id === archived.id ? archived : template)
    });
    setDraft(archived);
    setSavedMessage("テンプレートをアーカイブしました。");
    setSaveError(false);
  }

  if (!hydrated || !draft) {
    if (hydrated && !storedTemplate) {
      return (
        <div className="space-y-3">
          <MikkeEmptyState title="テンプレートが見つかりません" helper="一覧へ戻り、テンプレートを選び直してください。" />
          <Link href="/apps/team-works/project-templates" className="mx-auto block w-fit rounded-lg border border-[var(--mikke-line)] px-4 py-2.5 text-sm font-bold">テンプレート一覧へ</Link>
        </div>
      );
    }
    return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  }

  function updateRole(index: number, name: string) {
    const previous = draft.roleNames[index];
    const roleNames = draft.roleNames.map((role, roleIndex) => roleIndex === index ? name : role);
    change({
      ...draft,
      roleNames,
      phases: draft.phases.map((phase) => phase.ownerRoleName === previous ? { ...phase, ownerRoleName: name } : phase),
      tasks: draft.tasks.map((task) => task.assigneeRoleName === previous ? { ...task, assigneeRoleName: name } : task),
      forms: draft.forms.map((form) => ({
        ...form,
        inputRoleName: form.inputRoleName === previous ? name : form.inputRoleName,
        reviewerRoleName: form.reviewerRoleName === previous ? name : form.reviewerRoleName
      }))
    });
  }

  function removeRole(index: number) {
    if (draft.roleNames.length <= 1) return;
    const removed = draft.roleNames[index];
    const roleNames = draft.roleNames.filter((_, roleIndex) => roleIndex !== index);
    const fallback = roleNames[0];
    change({
      ...draft,
      roleNames,
      phases: draft.phases.map((phase) => phase.ownerRoleName === removed ? { ...phase, ownerRoleName: fallback } : phase),
      tasks: draft.tasks.map((task) => task.assigneeRoleName === removed ? { ...task, assigneeRoleName: fallback } : task),
      forms: draft.forms.map((form) => ({
        ...form,
        inputRoleName: form.inputRoleName === removed ? fallback : form.inputRoleName,
        reviewerRoleName: form.reviewerRoleName === removed ? fallback : form.reviewerRoleName
      }))
    });
  }

  function addRole() {
    const role = newRoleName.trim();
    if (!role || draft.roleNames.includes(role)) return;
    change({ ...draft, roleNames: [...draft.roleNames, role] });
    setNewRoleName("");
  }

  function normalizePhases(phases: ProjectTemplatePhase[]) {
    return phases.map((phase, position) => ({ ...phase, position }));
  }

  function updatePhase(phaseId: string, patch: Partial<ProjectTemplatePhase>) {
    change({ ...draft, phases: draft.phases.map((phase) => phase.id === phaseId ? { ...phase, ...patch } : phase) });
  }

  function addPhase(afterIndex = draft.phases.length - 1) {
    const phase: ProjectTemplatePhase = {
      id: createTeamWorksProjectId("team_works_template_phase"),
      name: "新しい工程",
      description: "",
      position: afterIndex + 1,
      standardDays: 1,
      weight: 0,
      required: true,
      ownerRoleName: draft.roleNames[0] ?? "担当者",
      startCondition: "前の工程が完了したら",
      completionCondition: "必要な作業と確認が終わったら",
      clientVisible: false
    };
    const phases = [...draft.phases];
    phases.splice(afterIndex + 1, 0, phase);
    change({ ...draft, phases: normalizePhases(phases) });
  }

  function duplicatePhase(phaseId: string) {
    const index = draft.phases.findIndex((phase) => phase.id === phaseId);
    if (index < 0) return;
    const source = draft.phases[index];
    const copyId = createTeamWorksProjectId("team_works_template_phase");
    const copy: ProjectTemplatePhase = { ...source, id: copyId, name: `${source.name}（複製）`, weight: 0 };
    const phases = [...draft.phases];
    phases.splice(index + 1, 0, copy);
    const copiedTasks = draft.tasks.filter((task) => task.phaseId === source.id).map((task) => ({
      ...task,
      id: createTeamWorksProjectId("team_works_template_task"),
      phaseId: copyId
    }));
    const copiedForms = draft.forms.filter((form) => form.phaseId === source.id).map((form) => ({
      ...form,
      id: createTeamWorksProjectId("team_works_template_form"),
      phaseId: copyId,
      taskId: null
    }));
    change({
      ...draft,
      phases: normalizePhases(phases),
      tasks: [...draft.tasks, ...copiedTasks],
      forms: [...draft.forms, ...copiedForms]
    });
  }

  function removePhase(phaseId: string) {
    change({
      ...draft,
      phases: normalizePhases(draft.phases.filter((phase) => phase.id !== phaseId)),
      tasks: draft.tasks.filter((task) => task.phaseId !== phaseId),
      forms: draft.forms.filter((form) => form.phaseId !== phaseId)
    });
  }

  function movePhase(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= draft.phases.length || fromIndex === toIndex) return;
    const phases = [...draft.phases];
    const [moved] = phases.splice(fromIndex, 1);
    phases.splice(toIndex, 0, moved);
    change({ ...draft, phases: normalizePhases(phases) });
  }

  function updateTask(taskId: string, patch: Partial<ProjectTemplateTask>) {
    change({ ...draft, tasks: draft.tasks.map((task) => task.id === taskId ? { ...task, ...patch } : task) });
  }

  function addTask(phaseId: string) {
    const phaseTasks = draft.tasks.filter((task) => task.phaseId === phaseId);
    const task: ProjectTemplateTask = {
      id: createTeamWorksProjectId("team_works_template_task"),
      phaseId,
      title: "新しいタスク",
      description: "",
      position: phaseTasks.length,
      standardOffsetDays: 1,
      priority: "normal",
      required: true,
      assigneeRoleName: draft.roleNames[0] ?? "担当者",
      checklist: [],
      requiresDeliverable: false,
      requiresApproval: false,
      requiresClientAction: false,
      clientVisible: false
    };
    change({ ...draft, tasks: [...draft.tasks, task] });
  }

  function duplicateTask(taskId: string) {
    const source = draft.tasks.find((task) => task.id === taskId);
    if (!source) return;
    const phaseTasks = draft.tasks.filter((task) => task.phaseId === source.phaseId);
    change({
      ...draft,
      tasks: [...draft.tasks, {
        ...source,
        id: createTeamWorksProjectId("team_works_template_task"),
        title: `${source.title}（複製）`,
        position: phaseTasks.length
      }]
    });
  }

  function removeTask(taskId: string) {
    change({
      ...draft,
      tasks: draft.tasks.filter((task) => task.id !== taskId),
      forms: draft.forms.filter((form) => form.taskId !== taskId)
    });
  }

  function moveTask(phaseId: string, taskId: string, direction: -1 | 1) {
    const phaseTasks = draft.tasks.filter((task) => task.phaseId === phaseId).sort((a, b) => a.position - b.position);
    const index = phaseTasks.findIndex((task) => task.id === taskId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= phaseTasks.length) return;
    [phaseTasks[index], phaseTasks[target]] = [phaseTasks[target], phaseTasks[index]];
    const positions = new Map(phaseTasks.map((task, position) => [task.id, position]));
    change({ ...draft, tasks: draft.tasks.map((task) => positions.has(task.id) ? { ...task, position: positions.get(task.id) ?? task.position } : task) });
  }

  function addForm(phaseId: string) {
    const form: ProjectTemplateForm = {
      id: createTeamWorksProjectId("team_works_template_form"),
      phaseId,
      taskId: null,
      name: "新しいフォーム枠",
      inputRoleName: draft.roleNames[0] ?? "担当者",
      reviewerRoleName: draft.roleNames[0] ?? "担当者",
      required: true,
      clientVisible: false
    };
    change({ ...draft, forms: [...draft.forms, form] });
  }

  function updateForm(formId: string, patch: Partial<ProjectTemplateForm>) {
    change({ ...draft, forms: draft.forms.map((form) => form.id === formId ? { ...form, ...patch } : form) });
  }

  return (
    <div className="space-y-6">
      <section className="sticky top-24 z-20 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[var(--mikke-muted)]">自社専用テンプレート</p>
            <p className="mt-1 text-sm font-bold">工程 {draft.phases.length}件・タスク {draft.tasks.length}件・比重 {totalWeight}%</p>
            <p className="mt-1 text-xs text-[var(--mikke-muted)]">{currentVersion ? `現在 Ver.${currentVersion.version}` : "バージョン未作成"}・使用中プロジェクト {usedProjectCount}件</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {savedMessage ? <span className={`inline-flex items-center gap-1 text-xs font-bold ${saveError ? "text-[var(--mikke-danger)]" : "text-[var(--mikke-success)]"}`}>{saveError ? null : <Check size={14} />} {savedMessage}</span> : null}
            <button type="button" onClick={() => save("overwrite")} disabled={!draft.name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
              <Save size={16} /> {currentVersion ? "現在の版へ上書き" : "Ver.1として保存"}
            </button>
            <button type="button" onClick={() => save("new_version")} disabled={!draft.name.trim()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-4 py-2.5 text-sm font-bold disabled:opacity-40"><History size={16} /> 新バージョン保存</button>
          </div>
        </div>
      </section>

      <MikkeSection title="基本情報">
        <div className="grid gap-4 sm:grid-cols-2">
          <TeamWorksProjectField label="テンプレート名" required className="sm:col-span-2">
            <input value={draft.name} onChange={(event) => change({ ...draft, name: event.target.value })} className={teamWorksProjectInputClass} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="説明" className="sm:col-span-2">
            <textarea value={draft.description} onChange={(event) => change({ ...draft, description: event.target.value })} rows={3} className={`${teamWorksProjectInputClass} resize-none`} />
          </TeamWorksProjectField>
          <TeamWorksProjectField label="状態">
            <select value={draft.status} onChange={(event) => change({ ...draft, status: event.target.value as ProjectTemplate["status"] })} className={teamWorksProjectInputClass}>
              {Object.entries(templateStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </TeamWorksProjectField>
          <TeamWorksProjectField label="標準期間" helper="各工程の標準日数から自動計算します。">
            <input value={`${draft.standardDurationDays}日`} readOnly className={`${teamWorksProjectInputClass} bg-[var(--mikke-bg)]`} />
          </TeamWorksProjectField>
        </div>
      </MikkeSection>

      <div id="roles">
        <MikkeSection title="役割">
          <div className="space-y-2">
          {draft.roleNames.map((role, index) => (
            <div key={`${index}-${role}`} className="flex gap-2">
              <input value={role} onChange={(event) => updateRole(index, event.target.value)} className={teamWorksProjectInputClass} aria-label={`役割 ${index + 1}`} />
              <button type="button" onClick={() => removeRole(index)} disabled={draft.roleNames.length <= 1} className="mt-1.5 rounded-lg border border-[var(--mikke-line)] px-3 text-[var(--mikke-danger)] disabled:opacity-30" aria-label={`${role}を削除`}><Trash2 size={16} /></button>
            </div>
          ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} placeholder="追加する役割名" className={teamWorksProjectInputClass} />
            <button type="button" onClick={addRole} className="mt-1.5 shrink-0 rounded-lg border border-[var(--mikke-line)] px-4 text-sm font-bold"><Plus size={16} /></button>
          </div>
        </MikkeSection>
      </div>

      <MikkeSection title="使用機能">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {(Object.entries({ clientPortal: "クライアント共有", deliverables: "成果物", comments: "コメント", payouts: "報酬", invoices: "請求" }) as [keyof ProjectTemplate["featureSettings"], string][]).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] p-3 text-sm font-bold">
              <input type="checkbox" checked={draft.featureSettings[key]} onChange={(event) => change({ ...draft, featureSettings: { ...draft.featureSettings, [key]: event.target.checked } })} />
              {label}
            </label>
          ))}
        </div>
      </MikkeSection>

      <section id="phases" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">工程ビルダー</h2>
            <p className="mt-1 text-xs text-[var(--mikke-muted)]">ドラッグまたは上下ボタンで並び替えできます。比重の合計目安は100%です。</p>
          </div>
          <button type="button" onClick={() => addPhase()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-4 py-2.5 text-sm font-bold"><Plus size={16} /> 工程を追加</button>
        </div>

        {draft.phases.length === 0 ? (
          <MikkeEmptyState title="工程はまだありません" helper="最初の工程を追加してください。" />
        ) : draft.phases.map((phase, index) => {
          const phaseTasks = draft.tasks.filter((task) => task.phaseId === phase.id).sort((a, b) => a.position - b.position);
          const phaseForms = draft.forms.filter((form) => form.phaseId === phase.id);
          return (
            <article
              key={phase.id}
              draggable
              onDragStart={() => setDraggedPhaseId(phase.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                const fromIndex = draft.phases.findIndex((item) => item.id === draggedPhaseId);
                movePhase(fromIndex, index);
                setDraggedPhaseId(null);
              }}
              className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mikke-line)] pb-4">
                <div className="flex items-center gap-2">
                  <GripVertical size={18} className="text-[var(--mikke-muted)]" />
                  <span className="rounded-full bg-[var(--mikke-primary)] px-2.5 py-1 text-xs font-bold text-white">工程 {index + 1}</span>
                  <strong>{phase.name}</strong>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton label="上へ" onClick={() => movePhase(index, index - 1)} disabled={index === 0}><ArrowUp size={15} /></IconButton>
                  <IconButton label="下へ" onClick={() => movePhase(index, index + 1)} disabled={index === draft.phases.length - 1}><ArrowDown size={15} /></IconButton>
                  <IconButton label="工程を複製" onClick={() => duplicatePhase(phase.id)}><Copy size={15} /></IconButton>
                  <IconButton label="工程を削除" onClick={() => removePhase(phase.id)} danger><Trash2 size={15} /></IconButton>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <TeamWorksProjectField label="工程名" required className="sm:col-span-2">
                  <input value={phase.name} onChange={(event) => updatePhase(phase.id, { name: event.target.value })} className={teamWorksProjectInputClass} />
                </TeamWorksProjectField>
                <TeamWorksProjectField label="標準日数">
                  <input value={phase.standardDays} onChange={(event) => updatePhase(phase.id, { standardDays: Number(event.target.value.replace(/\D/g, "")) })} inputMode="numeric" className={teamWorksProjectInputClass} />
                </TeamWorksProjectField>
                <TeamWorksProjectField label="工程比重">
                  <input value={phase.weight} onChange={(event) => updatePhase(phase.id, { weight: Number(event.target.value.replace(/\D/g, "")) })} inputMode="numeric" className={teamWorksProjectInputClass} />
                </TeamWorksProjectField>
                <TeamWorksProjectField label="説明" className="sm:col-span-2 lg:col-span-4">
                  <textarea value={phase.description} onChange={(event) => updatePhase(phase.id, { description: event.target.value })} rows={2} className={`${teamWorksProjectInputClass} resize-none`} />
                </TeamWorksProjectField>
                <TeamWorksProjectField label="担当役割">
                  <select value={phase.ownerRoleName} onChange={(event) => updatePhase(phase.id, { ownerRoleName: event.target.value })} className={teamWorksProjectInputClass}>
                    {draft.roleNames.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </TeamWorksProjectField>
                <TeamWorksProjectField label="開始条件" className="sm:col-span-2 lg:col-span-3">
                  <input value={phase.startCondition} onChange={(event) => updatePhase(phase.id, { startCondition: event.target.value })} className={teamWorksProjectInputClass} />
                </TeamWorksProjectField>
                <TeamWorksProjectField label="完了条件" className="sm:col-span-2 lg:col-span-3">
                  <input value={phase.completionCondition} onChange={(event) => updatePhase(phase.id, { completionCondition: event.target.value })} className={teamWorksProjectInputClass} />
                </TeamWorksProjectField>
                <div className="flex items-end gap-4 pb-2">
                  <CheckField label="必須" checked={phase.required} onChange={(required) => updatePhase(phase.id, { required })} />
                  <CheckField label="クライアント公開" checked={phase.clientVisible} onChange={(clientVisible) => updatePhase(phase.id, { clientVisible })} />
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-[var(--mikke-bg)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold">タスク</h3>
                  <button type="button" onClick={() => addTask(phase.id)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-xs font-bold"><Plus size={14} /> タスク追加</button>
                </div>
                <div className="mt-3 space-y-3">
                  {phaseTasks.map((task, taskIndex) => (
                    <TaskBlock
                      key={task.id}
                      task={task}
                      index={taskIndex}
                      total={phaseTasks.length}
                      roles={draft.roleNames}
                      onUpdate={(patch) => updateTask(task.id, patch)}
                      onMove={(direction) => moveTask(phase.id, task.id, direction)}
                      onDuplicate={() => duplicateTask(task.id)}
                      onRemove={() => removeTask(task.id)}
                    />
                  ))}
                  {phaseTasks.length === 0 ? <p className="py-3 text-center text-xs text-[var(--mikke-muted)]">タスク枠はありません。</p> : null}
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-[var(--mikke-bg)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><h3 className="text-sm font-bold">フォーム枠</h3><p className="mt-1 text-xs text-[var(--mikke-muted)]">項目タイプの詳細は後続フェーズで追加します。</p></div>
                  <button type="button" onClick={() => addForm(phase.id)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2 text-xs font-bold"><Plus size={14} /> フォーム枠追加</button>
                </div>
                <div className="mt-3 space-y-2">
                  {phaseForms.map((form) => (
                    <div key={form.id} className="grid gap-3 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-3 sm:grid-cols-2 lg:grid-cols-5">
                      <TeamWorksProjectField label="名称" className="sm:col-span-2"><input value={form.name} onChange={(event) => updateForm(form.id, { name: event.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
                      <TeamWorksProjectField label="入力者"><select value={form.inputRoleName} onChange={(event) => updateForm(form.id, { inputRoleName: event.target.value })} className={teamWorksProjectInputClass}>{draft.roleNames.map((role) => <option key={role} value={role}>{role}</option>)}</select></TeamWorksProjectField>
                      <TeamWorksProjectField label="確認者"><select value={form.reviewerRoleName} onChange={(event) => updateForm(form.id, { reviewerRoleName: event.target.value })} className={teamWorksProjectInputClass}>{draft.roleNames.map((role) => <option key={role} value={role}>{role}</option>)}</select></TeamWorksProjectField>
                      <div className="flex items-end justify-between gap-2 pb-2"><CheckField label="必須" checked={form.required} onChange={(required) => updateForm(form.id, { required })} /><CheckField label="公開" checked={form.clientVisible} onChange={(clientVisible) => updateForm(form.id, { clientVisible })} /><IconButton label="フォーム枠を削除" onClick={() => change({ ...draft, forms: draft.forms.filter((item) => item.id !== form.id) })} danger><Trash2 size={15} /></IconButton></div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <MikkeSection title="バージョン履歴">
        {versions.length > 0 ? (
          <div className="space-y-2">
            {versions.map((version) => (
              <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--mikke-line)] p-3 text-sm">
                <div>
                  <p className="font-bold">Ver.{version.version} {version.id === draft.currentVersionId ? <span className="ml-2 text-xs text-[var(--mikke-accent)]">現在の版</span> : null}</p>
                  <p className="mt-1 text-xs text-[var(--mikke-muted)]">工程 {version.snapshot.phases.length}件・タスク {version.snapshot.tasks.length}件・{new Date(version.createdAt).toLocaleString("ja-JP")}</p>
                </div>
                <span className="text-xs text-[var(--mikke-muted)]">進行中案件へは自動反映しません</span>
              </div>
            ))}
          </div>
        ) : <MikkeEmptyState title="バージョンはまだありません" helper="上書き保存でVer.1を作成できます。" />}
      </MikkeSection>

      <section className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-bg)] p-5 text-center">
        <p className="text-sm font-bold">テンプレート管理</p>
        <p className="mt-1 text-xs text-[var(--mikke-muted)]">案件作成時は現在の版をコピーし、その後のテンプレート変更を既存案件へ自動反映しません。</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/apps/team-works/project-templates" className="rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-4 py-2.5 text-sm font-bold">一覧へ戻る</Link>
          {draft.status === "active" ? <Link href={`/apps/team-works/projects/new?templateId=${draft.id}`} className="rounded-lg bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white">このテンプレートから案件を作る</Link> : null}
          <button type="button" onClick={duplicateTemplate} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-4 py-2.5 text-sm font-bold"><Copy size={16} /> 複製</button>
          {draft.status !== "archived" ? <button type="button" onClick={archiveTemplate} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-4 py-2.5 text-sm font-bold text-[var(--mikke-danger)]"><Archive size={16} /> アーカイブ</button> : null}
        </div>
      </section>
    </div>
  );
}

function TaskBlock({ task, index, total, roles, onUpdate, onMove, onDuplicate, onRemove }: {
  task: ProjectTemplateTask;
  index: number;
  total: number;
  roles: string[];
  onUpdate: (patch: Partial<ProjectTemplateTask>) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-[var(--mikke-muted)]">タスク {index + 1}</span>
        <div className="flex gap-1">
          <IconButton label="タスクを上へ" onClick={() => onMove(-1)} disabled={index === 0}><ArrowUp size={14} /></IconButton>
          <IconButton label="タスクを下へ" onClick={() => onMove(1)} disabled={index === total - 1}><ArrowDown size={14} /></IconButton>
          <IconButton label="タスクを複製" onClick={onDuplicate}><Copy size={14} /></IconButton>
          <IconButton label="タスクを削除" onClick={onRemove} danger><Trash2 size={14} /></IconButton>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TeamWorksProjectField label="タスク名" required className="sm:col-span-2"><input value={task.title} onChange={(event) => onUpdate({ title: event.target.value })} className={teamWorksProjectInputClass} /></TeamWorksProjectField>
        <TeamWorksProjectField label="担当役割"><select value={task.assigneeRoleName} onChange={(event) => onUpdate({ assigneeRoleName: event.target.value })} className={teamWorksProjectInputClass}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></TeamWorksProjectField>
        <TeamWorksProjectField label="期限（日数）"><input value={task.standardOffsetDays} onChange={(event) => onUpdate({ standardOffsetDays: Number(event.target.value.replace(/\D/g, "")) })} inputMode="numeric" className={teamWorksProjectInputClass} /></TeamWorksProjectField>
        <TeamWorksProjectField label="説明" className="sm:col-span-2"><textarea value={task.description} onChange={(event) => onUpdate({ description: event.target.value })} rows={2} className={`${teamWorksProjectInputClass} resize-none`} /></TeamWorksProjectField>
        <TeamWorksProjectField label="優先度"><select value={task.priority} onChange={(event) => onUpdate({ priority: event.target.value as ProjectTaskPriority })} className={teamWorksProjectInputClass}>{priorities.map((priority) => <option key={priority} value={priority}>{projectTaskPriorityLabels[priority]}</option>)}</select></TeamWorksProjectField>
        <TeamWorksProjectField label="チェックリスト" helper="1行に1項目"><textarea value={task.checklist.join("\n")} onChange={(event) => onUpdate({ checklist: event.target.value.split("\n").filter(Boolean) })} rows={2} className={`${teamWorksProjectInputClass} resize-none`} /></TeamWorksProjectField>
      </div>
      <div className="mt-3 flex flex-wrap gap-4">
        <CheckField label="必須" checked={task.required} onChange={(required) => onUpdate({ required })} />
        <CheckField label="成果物あり" checked={task.requiresDeliverable} onChange={(requiresDeliverable) => onUpdate({ requiresDeliverable })} />
        <CheckField label="承認あり" checked={task.requiresApproval} onChange={(requiresApproval) => onUpdate({ requiresApproval })} />
        <CheckField label="クライアント対応" checked={task.requiresClientAction} onChange={(requiresClientAction) => onUpdate({ requiresClientAction })} />
        <CheckField label="クライアント公開" checked={task.clientVisible} onChange={(clientVisible) => onUpdate({ clientVisible })} />
      </div>
    </div>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="inline-flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}</label>;
}

function IconButton({ label, onClick, disabled = false, danger = false, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={`rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-2 disabled:opacity-30 ${danger ? "text-[var(--mikke-danger)]" : "text-[var(--mikke-primary)]"}`}>
      {children}
    </button>
  );
}
