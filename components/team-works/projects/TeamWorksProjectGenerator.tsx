"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { supabase } from "@/lib/supabase/client";
import {
  loadOperationsPartnerDirectory,
  loadOperationsClientDirectory,
  type OperationsPartnerDirectoryEntry,
  type OperationsClientDirectoryEntry
} from "@/lib/team-works-operations-project";
import {
  createDeliveryProjectWithSetup,
  deliveryTaskOwnerRoleLabels,
  deliveryTaskSubmissionTypeLabels,
  emptyDeliveryTaskInstruction,
  fetchStepTemplates,
  type DeliveryStepTemplate,
  type DeliveryTaskInstruction,
  type DeliveryTaskOwnerRole,
  type DeliveryTaskSubmissionType
} from "@/lib/team-works-delivery";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "./TeamWorksProjectsShell";
import { TeamWorksTaskInstructionEditor } from "./TeamWorksTaskInstructionEditor";

type WizardStep = 1 | 2 | 3 | 4;

type SelectedMember = { directoryTable: "team_works_partners" | "team_works_clients"; directoryId: string; displayName: string; projectRole: "worker" | "client" };

// 名簿にまだいない相手。名前だけ置いておき、工程の担当に指定できる。
// 実メンバーが決まったらプロジェクト詳細で差し替える。
type PlaceholderMember = { key: string; name: string; projectRole: "worker" | "client" };

type StepRow = {
  key: string;
  title: string;
  clientVisible: boolean;
  ownerRole: DeliveryTaskOwnerRole | "";
  submissionType: DeliveryTaskSubmissionType;
  needsInternalReview: boolean;
  needsClientReview: boolean;
  standardDays: string;
  // 担当。名簿の相手なら directoryId、名前だけの仮担当なら label に入る。
  assigneeDirectoryId: string;
  assigneeLabel: string;
  instruction: DeliveryTaskInstruction;
};

const ownerRoleOptions = Object.keys(deliveryTaskOwnerRoleLabels) as DeliveryTaskOwnerRole[];
const submissionTypeOptions = Object.keys(deliveryTaskSubmissionTypeLabels) as DeliveryTaskSubmissionType[];

let rowKeySeed = 0;
function newRowKey() {
  rowKeySeed += 1;
  return `row_${rowKeySeed}`;
}

function newStepRow(partial: Partial<StepRow> = {}): StepRow {
  return {
    key: newRowKey(),
    title: "",
    clientVisible: false,
    ownerRole: "",
    submissionType: "none",
    needsInternalReview: false,
    needsClientReview: false,
    standardDays: "",
    assigneeDirectoryId: "",
    assigneeLabel: "",
    instruction: emptyDeliveryTaskInstruction,
    ...partial
  };
}

// 担当セレクトの値。名簿の相手は "dir:<id>"、仮担当は "label:<名前>"。
function assigneeSelectValue(row: StepRow) {
  if (row.assigneeDirectoryId) return `dir:${row.assigneeDirectoryId}`;
  if (row.assigneeLabel) return `label:${row.assigneeLabel}`;
  return "";
}

function parseAssigneeSelectValue(value: string): Pick<StepRow, "assigneeDirectoryId" | "assigneeLabel"> {
  if (value.startsWith("dir:")) return { assigneeDirectoryId: value.slice(4), assigneeLabel: "" };
  if (value.startsWith("label:")) return { assigneeDirectoryId: "", assigneeLabel: value.slice(6) };
  return { assigneeDirectoryId: "", assigneeLabel: "" };
}

function assigneeSummaryLabel(row: StepRow, selectedMembers: SelectedMember[]) {
  if (row.assigneeDirectoryId) {
    const member = selectedMembers.find((item) => item.directoryId === row.assigneeDirectoryId);
    return member ? `・${member.displayName}` : "";
  }
  return row.assigneeLabel ? `・${row.assigneeLabel}(仮)` : "";
}

// 折りたたんだ状態でも中身が入っているか分かるようにする短い要約。
function instructionSummary(instruction: DeliveryTaskInstruction) {
  const filled = [
    instruction.description,
    instruction.purpose,
    instruction.method,
    instruction.deliverableNote,
    instruction.checklist.some((item) => item.trim()) ? "checklist" : null,
    instruction.outputs.some((item) => item.trim()) ? "outputs" : null
  ].filter(Boolean).length;
  return filled > 0 ? `${filled}項目` : "";
}

function templateRoleToOwnerRole(role: "worker" | "client" | "manager" | null): DeliveryTaskOwnerRole | "" {
  if (role === "manager") return "admin";
  if (role === "worker") return "worker";
  if (role === "client") return "client";
  return "";
}

// 4段階の質問フロー: ①ゴール ②メンバーと役割 ③作業の順番(自由入力・並べ替え)
// ④クライアント公開設定 → 作成。作った時点ではタスクに期日は付けない
// (期日・担当・状態変更はプロジェクト詳細画面で後から自由に行う)。
export function TeamWorksProjectGenerator() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);

  const [title, setTitle] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [description, setDescription] = useState("");

  const [partners, setPartners] = useState<OperationsPartnerDirectoryEntry[]>([]);
  const [clients, setClients] = useState<OperationsClientDirectoryEntry[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [placeholderMembers, setPlaceholderMembers] = useState<PlaceholderMember[]>([]);
  const [placeholderDraft, setPlaceholderDraft] = useState("");
  const [placeholderRole, setPlaceholderRole] = useState<"worker" | "client">("worker");
  const [directoryError, setDirectoryError] = useState("");

  const [templates, setTemplates] = useState<DeliveryStepTemplate[]>([]);
  const [rows, setRows] = useState<StepRow[]>([]);
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [skippedNames, setSkippedNames] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([loadOperationsPartnerDirectory(supabase), loadOperationsClientDirectory(supabase), fetchStepTemplates(supabase)])
      .then(([partnerRows, clientRows, templateRows]) => {
        setPartners(partnerRows.filter((row) => row.status === "active"));
        setClients(clientRows.filter((row) => row.status === "active"));
        setTemplates(templateRows);
      })
      .catch((error) => setDirectoryError(error instanceof Error ? error.message : "名簿を読み込めませんでした。"));
  }, []);

  function toggleMember(directoryTable: "team_works_partners" | "team_works_clients", entry: OperationsPartnerDirectoryEntry | OperationsClientDirectoryEntry) {
    const projectRole = directoryTable === "team_works_partners" ? "worker" : "client";
    setSelectedMembers((current) => {
      const exists = current.some((member) => member.directoryId === entry.id);
      if (exists) return current.filter((member) => member.directoryId !== entry.id);
      return [...current, { directoryTable, directoryId: entry.id, displayName: entry.displayName, projectRole }];
    });
  }

  function addPlaceholderMember() {
    const name = placeholderDraft.trim();
    if (!name) return;
    setPlaceholderMembers((current) =>
      current.some((member) => member.name === name) ? current : [...current, { key: newRowKey(), name, projectRole: placeholderRole }]
    );
    setPlaceholderDraft("");
  }

  function removePlaceholderMember(key: string) {
    const removed = placeholderMembers.find((member) => member.key === key);
    setPlaceholderMembers((current) => current.filter((member) => member.key !== key));
    // その仮担当を指していた工程は未割当に戻す。
    if (removed) {
      setRows((current) => current.map((row) => (row.assigneeLabel === removed.name ? { ...row, assigneeLabel: "" } : row)));
    }
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setRows(
      template.steps.map((templateStep) =>
        newStepRow({
          title: templateStep.title,
          ownerRole: templateRoleToOwnerRole(templateStep.defaultRole),
          submissionType: templateStep.submissionType ?? "none",
          needsInternalReview: templateStep.needsInternalReview ?? false,
          needsClientReview: templateStep.needsClientReview ?? false,
          standardDays: templateStep.standardDays ? String(templateStep.standardDays) : "",
          assigneeLabel: templateStep.assigneeLabel ?? "",
          instruction: { ...emptyDeliveryTaskInstruction, ...templateStep.instruction }
        })
      )
    );
  }

  function addRow() {
    setRows((current) => [...current, newStepRow()]);
  }

  function updateRow(key: string, patch: Partial<StepRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function moveRow(index: number, direction: -1 | 1) {
    setRows((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const validRows = useMemo(() => rows.filter((row) => row.title.trim().length > 0), [rows]);

  async function submit() {
    setSaving(true);
    setSubmitError("");
    try {
      const result = await createDeliveryProjectWithSetup(supabase, {
        organizationName,
        title,
        members: selectedMembers.map(({ directoryTable, directoryId, projectRole }) => ({ directoryTable, directoryId, projectRole })),
        steps: validRows.map((row) => ({
          title: row.title.trim(),
          clientVisible: row.clientVisible,
          ownerRole: row.ownerRole || null,
          submissionType: row.submissionType,
          needsInternalReview: row.needsInternalReview,
          needsClientReview: row.needsClientReview,
          standardDays: row.standardDays ? Number(row.standardDays) : null,
          assigneeDirectoryId: row.assigneeDirectoryId || null,
          assigneeLabel: row.assigneeLabel || null,
          instruction: {
            ...row.instruction,
            // 追加ボタンで作った未入力の行は保存前に落とす。
            checklist: row.instruction.checklist.map((item) => item.trim()).filter(Boolean),
            outputs: row.instruction.outputs.map((item) => item.trim()).filter(Boolean)
          }
        }))
      });
      if (result.skippedMembers.length > 0) {
        setSkippedNames(
          selectedMembers.filter((member) => result.skippedMembers.includes(member.directoryId)).map((member) => member.displayName)
        );
        setSaving(false);
        return;
      }
      router.push(`/apps/team-works/projects/${result.projectId}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "プロジェクトを作成できませんでした。");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-6 flex flex-wrap gap-2 text-xs font-bold">
        <WizardTab index={1} current={step} label="ゴール" onSelect={setStep} />
        <WizardTab index={2} current={step} label="メンバー" onSelect={setStep} />
        <WizardTab index={3} current={step} label="作業の順番" onSelect={setStep} />
        <WizardTab index={4} current={step} label="確認・公開設定" onSelect={setStep} />
      </ol>

      {step === 1 ? (
        <MikkeSection title="① 期日までに何をするか">
          <div className="grid gap-4">
            <TeamWorksProjectField label="プロジェクト名" required>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例：認定講座 個別構築コース" className={teamWorksProjectInputClass} />
            </TeamWorksProjectField>
            <TeamWorksProjectField label="組織名" helper="すでに所属組織がある場合は既存組織を使い、この入力は初回セットアップ時だけ使用します。">
              <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="例：株式会社◯◯、◯◯事務所" className={teamWorksProjectInputClass} />
            </TeamWorksProjectField>
            <TeamWorksProjectField label="目的・完成条件" helper="このプロジェクトが完了した時、何ができあがっているか。">
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="例：講座一式(テキスト・キット・動画・Academy)が完成し、運営を開始できる状態" className={`${teamWorksProjectInputClass} resize-none`} />
            </TeamWorksProjectField>
          </div>
        </MikkeSection>
      ) : null}

      {step === 2 ? (
        <MikkeSection title="② メンバーは誰がいるか、それぞれの役割">
          <p className="-mt-2 mb-3 text-xs font-semibold text-[var(--mikke-muted)]">名簿に登録済みで、ポータルにログイン済みの相手はチェックで追加できます。まだ決まっていない・登録していない相手は、下の「仮の担当名」に自由に書いて先に進めます。</p>
          {directoryError ? <p role="alert" className="mb-3 rounded-xl border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{directoryError}</p> : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-extrabold text-[var(--mikke-muted)]">担当メンバー(パートナー名簿)</p>
              <div className="space-y-1.5 rounded-xl border border-[var(--mikke-line)] p-3">
                {partners.length === 0 ? <p className="text-xs font-semibold text-[var(--mikke-muted)]">登録済みパートナーはいません。</p> : null}
                {partners.map((partner) => (
                  <label key={partner.id} className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={selectedMembers.some((member) => member.directoryId === partner.id)} onChange={() => toggleMember("team_works_partners", partner)} />
                    {partner.displayName}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-extrabold text-[var(--mikke-muted)]">クライアント(クライアント名簿)</p>
              <div className="space-y-1.5 rounded-xl border border-[var(--mikke-line)] p-3">
                {clients.length === 0 ? <p className="text-xs font-semibold text-[var(--mikke-muted)]">登録済みクライアントはいません。</p> : null}
                {clients.map((client) => (
                  <label key={client.id} className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={selectedMembers.some((member) => member.directoryId === client.id)} onChange={() => toggleMember("team_works_clients", client)} />
                    {client.displayName}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
            <p className="text-xs font-extrabold">仮の担当名(名簿になくてもOK)</p>
            <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">
              例：教材制作担当、カメラマン(未定)、ネオン。次の「作業の順番」で各工程の担当として選べます。
              実際の人が決まったら、プロジェクト詳細で本人に差し替えてください。
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={placeholderDraft}
                onChange={(event) => setPlaceholderDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addPlaceholderMember();
                  }
                }}
                placeholder="例：教材制作担当"
                className="min-w-0 flex-1 rounded-lg border border-[var(--mikke-line)] bg-white px-2.5 py-2 text-sm"
              />
              <select value={placeholderRole} onChange={(event) => setPlaceholderRole(event.target.value as "worker" | "client")} className="rounded-lg border border-[var(--mikke-line)] bg-white px-2 py-2 text-xs font-bold">
                <option value="worker">担当メンバー</option>
                <option value="client">クライアント</option>
              </select>
              <button type="button" onClick={addPlaceholderMember} disabled={!placeholderDraft.trim()} className="inline-flex items-center gap-1 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold disabled:opacity-40">
                <Plus size={14} /> 追加
              </button>
            </div>
            {placeholderMembers.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {placeholderMembers.map((member) => (
                  <li key={member.key} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mikke-line)] bg-white px-2.5 py-1 text-xs font-bold">
                    {member.name}・{member.projectRole === "worker" ? "担当" : "クライアント"}
                    <button type="button" onClick={() => removePlaceholderMember(member.key)} className="text-[var(--tw-action)]" aria-label={`${member.name}を削除`}>
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </MikkeSection>
      ) : null}

      {step === 3 ? (
        <MikkeSection title="③ 作業の順番">
          <p className="-mt-2 mb-3 text-xs font-semibold text-[var(--mikke-muted)]">工程ごとに、誰がやるか・何を出すか・誰が確認するか・標準日数を決めます。あとからプロジェクト詳細でも調整できます。</p>
          {templates.length > 0 ? (
            <label className="mb-4 block text-xs font-bold">
              テンプレートから読み込む(任意)
              <select onChange={(event) => applyTemplate(event.target.value)} defaultValue="" className={teamWorksProjectInputClass}>
                <option value="" disabled>選択してください</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
            </label>
          ) : null}
          <div className="space-y-2">
            {rows.map((row, index) => (
              <div key={row.key} className="rounded-xl border border-[var(--mikke-line)] p-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center text-xs font-extrabold text-[var(--mikke-muted)]">{index + 1}</span>
                  <input value={row.title} onChange={(event) => updateRow(row.key, { title: event.target.value })} placeholder="例：ヒアリング・講座整理" className="min-w-0 flex-1 rounded-lg border border-[var(--mikke-line)] px-2.5 py-2 text-sm" />
                  <button type="button" onClick={() => moveRow(index, -1)} disabled={index === 0} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--mikke-line)] disabled:opacity-30"><ChevronUp size={14} /></button>
                  <button type="button" onClick={() => moveRow(index, 1)} disabled={index === rows.length - 1} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--mikke-line)] disabled:opacity-30"><ChevronDown size={14} /></button>
                  <button type="button" onClick={() => removeRow(row.key)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--tw-action)] text-[var(--tw-action)]"><Trash2 size={14} /></button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-8 text-[11px] font-bold">
                  <select value={row.ownerRole} onChange={(event) => updateRow(row.key, { ownerRole: event.target.value as DeliveryTaskOwnerRole | "" })} className="rounded-lg border border-[var(--mikke-line)] px-2 py-1.5">
                    <option value="">誰がやるか:未設定</option>
                    {ownerRoleOptions.map((role) => <option key={role} value={role}>{deliveryTaskOwnerRoleLabels[role]}</option>)}
                  </select>
                  <select
                    value={assigneeSelectValue(row)}
                    onChange={(event) => updateRow(row.key, parseAssigneeSelectValue(event.target.value))}
                    className="rounded-lg border border-[var(--mikke-line)] px-2 py-1.5"
                  >
                    <option value="">担当:未割当</option>
                    {selectedMembers.map((member) => (
                      <option key={member.directoryId} value={`dir:${member.directoryId}`}>{member.displayName}</option>
                    ))}
                    {placeholderMembers.map((member) => (
                      <option key={member.key} value={`label:${member.name}`}>{member.name}(仮)</option>
                    ))}
                  </select>
                  <select value={row.submissionType} onChange={(event) => updateRow(row.key, { submissionType: event.target.value as DeliveryTaskSubmissionType })} className="rounded-lg border border-[var(--mikke-line)] px-2 py-1.5">
                    {submissionTypeOptions.map((type) => <option key={type} value={type}>{deliveryTaskSubmissionTypeLabels[type]}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={row.needsInternalReview} onChange={(event) => updateRow(row.key, { needsInternalReview: event.target.checked })} />本部確認</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={row.needsClientReview} onChange={(event) => updateRow(row.key, { needsClientReview: event.target.checked })} />クライアント確認</label>
                  <input type="number" min={1} value={row.standardDays} onChange={(event) => updateRow(row.key, { standardDays: event.target.value })} placeholder="標準日数" className="w-20 rounded-lg border border-[var(--mikke-line)] px-2 py-1.5" />
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={row.clientVisible} onChange={(event) => updateRow(row.key, { clientVisible: event.target.checked })} />クライアントに公開</label>
                  <button
                    type="button"
                    onClick={() => setExpandedRowKey((current) => (current === row.key ? null : row.key))}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--mikke-line)] px-2 py-1.5"
                  >
                    作業指示{instructionSummary(row.instruction) ? `(${instructionSummary(row.instruction)})` : ""}
                    {expandedRowKey === row.key ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
                {expandedRowKey === row.key ? (
                  <div className="mt-2 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
                    <TeamWorksTaskInstructionEditor
                      value={row.instruction}
                      onChange={(instruction) => updateRow(row.key, { instruction })}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <button type="button" onClick={addRow} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-muted)]">
            <Plus size={14} /> 工程を追加
          </button>
        </MikkeSection>
      ) : null}

      {step === 4 ? (
        <MikkeSection title="④ 確認">
          <p className="-mt-2 mb-3 text-xs font-semibold text-[var(--mikke-muted)]">「公開」にした工程はクライアントポータルにも表示されます。作成後も変更できます。</p>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-extrabold text-[var(--mikke-muted)]">プロジェクト</p>
              <p className="font-bold">{title || "(未入力)"}</p>
              {description ? <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{description}</p> : null}
            </div>
            <div>
              <p className="text-xs font-extrabold text-[var(--mikke-muted)]">メンバー {selectedMembers.length}名</p>
              {selectedMembers.length === 0 ? <p className="text-xs text-[var(--mikke-muted)]">未選択</p> : (
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {selectedMembers.map((member) => (
                    <li key={member.directoryId} className="rounded-full border border-[var(--mikke-line)] px-2.5 py-1 text-xs font-bold">
                      {member.displayName}・{member.projectRole === "worker" ? "担当" : "クライアント"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-extrabold text-[var(--mikke-muted)]">作業の順番 {validRows.length}件</p>
              {validRows.length === 0 ? <p className="text-xs text-[var(--mikke-muted)]">未入力</p> : (
                <ol className="mt-1 space-y-1">
                  {validRows.map((row, index) => (
                    <li key={row.key} className="text-xs font-semibold">
                      {index + 1}. {row.title}
                      {row.ownerRole ? `・${deliveryTaskOwnerRoleLabels[row.ownerRole]}` : ""}
                      {assigneeSummaryLabel(row, selectedMembers)}
                      {row.submissionType !== "none" ? `・${deliveryTaskSubmissionTypeLabels[row.submissionType]}` : ""}
                      {row.needsInternalReview ? "・本部確認" : ""}
                      {row.needsClientReview ? "・クライアント確認" : ""}
                      {row.standardDays ? `・${row.standardDays}日` : ""}
                      {row.clientVisible ? "・公開" : ""}
                      {instructionSummary(row.instruction) ? `・作業指示${instructionSummary(row.instruction)}` : ""}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          {skippedNames.length > 0 ? (
            <p role="alert" className="mt-4 rounded-xl border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">
              プロジェクトは作成しましたが、次のメンバーはまだポータルへログインしていないため追加できませんでした: {skippedNames.join("、")}。ログイン後、プロジェクト詳細から改めて追加してください。
            </p>
          ) : null}
          {submitError ? <p role="alert" className="mt-4 rounded-xl border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{submitError}</p> : null}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || !title.trim()}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--tw-action)] px-4 py-2.5 text-sm font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]"
          >
            <Plus size={16} /> {saving ? "作成しています…" : "プロジェクトを作成"}
          </button>
        </MikkeSection>
      ) : null}

      <div className="mt-5 flex items-center justify-between">
        <button type="button" onClick={() => setStep((current) => (current > 1 ? ((current - 1) as WizardStep) : current))} disabled={step === 1} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-muted)] disabled:opacity-30">
          <ArrowLeft size={14} /> 戻る
        </button>
        {step < 4 ? (
          <button type="button" onClick={() => setStep((current) => (current < 4 ? ((current + 1) as WizardStep) : current))} disabled={step === 1 && !title.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--mikke-primary)] px-4 py-2 text-xs font-bold text-white disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]">
            次へ <ArrowRight size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function WizardTab({ index, current, label, onSelect }: { index: WizardStep; current: WizardStep; label: string; onSelect: (step: WizardStep) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(index)}
        className={`rounded-full px-3 py-1.5 ${current === index ? "bg-[var(--tw-title)] text-white" : "border border-[var(--mikke-line)] text-[var(--mikke-muted)]"}`}
      >
        {index}. {label}
      </button>
    </li>
  );
}
