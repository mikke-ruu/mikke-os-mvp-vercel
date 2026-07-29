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
import { createDeliveryProjectWithSetup, fetchStepTemplates, type DeliveryStepTemplate } from "@/lib/team-works-delivery";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "./TeamWorksProjectsShell";

type WizardStep = 1 | 2 | 3 | 4;

type SelectedMember = { directoryTable: "team_works_partners" | "team_works_clients"; directoryId: string; displayName: string; projectRole: "worker" | "client" };

type StepRow = { key: string; title: string; clientVisible: boolean };

let rowKeySeed = 0;
function newRowKey() {
  rowKeySeed += 1;
  return `row_${rowKeySeed}`;
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
  const [directoryError, setDirectoryError] = useState("");

  const [templates, setTemplates] = useState<DeliveryStepTemplate[]>([]);
  const [rows, setRows] = useState<StepRow[]>([]);

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

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setRows(template.steps.map((templateStep) => ({ key: newRowKey(), title: templateStep.title, clientVisible: false })));
  }

  function addRow() {
    setRows((current) => [...current, { key: newRowKey(), title: "", clientVisible: false }]);
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
        steps: validRows.map((row) => ({ title: row.title.trim(), clientVisible: row.clientVisible }))
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
          <p className="-mt-2 mb-3 text-xs font-semibold text-[var(--mikke-muted)]">名簿に登録済みで、ポータルにログイン済みの相手だけ追加できます。未登録の場合は先に「パートナー管理」「クライアント管理」で名簿登録してください。</p>
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
        </MikkeSection>
      ) : null}

      {step === 3 ? (
        <MikkeSection title="③ 作業の順番">
          <p className="-mt-2 mb-3 text-xs font-semibold text-[var(--mikke-muted)]">タイトルだけを自由に入力・並べ替えします。期日や担当は後からプロジェクト詳細で設定できます。</p>
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
              <div key={row.key} className="flex items-center gap-2 rounded-xl border border-[var(--mikke-line)] p-2">
                <span className="w-6 shrink-0 text-center text-xs font-extrabold text-[var(--mikke-muted)]">{index + 1}</span>
                <input value={row.title} onChange={(event) => updateRow(row.key, { title: event.target.value })} placeholder="例：ヒアリング・講座整理" className="min-w-0 flex-1 rounded-lg border border-[var(--mikke-line)] px-2.5 py-2 text-sm" />
                <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-[var(--mikke-muted)]">
                  <input type="checkbox" checked={row.clientVisible} onChange={(event) => updateRow(row.key, { clientVisible: event.target.checked })} />
                  公開
                </label>
                <button type="button" onClick={() => moveRow(index, -1)} disabled={index === 0} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--mikke-line)] disabled:opacity-30"><ChevronUp size={14} /></button>
                <button type="button" onClick={() => moveRow(index, 1)} disabled={index === rows.length - 1} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--mikke-line)] disabled:opacity-30"><ChevronDown size={14} /></button>
                <button type="button" onClick={() => removeRow(row.key)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--tw-action)] text-[var(--tw-action)]"><Trash2 size={14} /></button>
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
                    <li key={row.key} className="text-xs font-semibold">{index + 1}. {row.title}{row.clientVisible ? "・公開" : ""}</li>
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
            className="mt-5 w-full rounded-lg bg-[var(--tw-action)] px-4 py-3 text-sm font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]"
          >
            {saving ? "作成しています…" : "プロジェクトを作成"}
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
