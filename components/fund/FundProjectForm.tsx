"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { createFundCompletedActivity, createFundPublishedActivity } from "@/lib/fund/activity";
import { saveFundProjectContent } from "@/lib/fund/database";
import { useFundProjects } from "@/lib/fund/store";
import {
  fundCampaignTypeLabels,
  fundGoalTypeLabels,
  fundProjectStatusLabels,
  fundProjectTypeLabels,
  fundVisibilityLabels,
  type FundCampaignType,
  type FundGoalType,
  type FundPlanInput,
  type FundProject,
  type FundProjectStatus,
  type FundProjectType,
  type FundStage,
  type FundVisibility
} from "@/lib/fund/types";
import { isValidFundExternalUrl, normalizeFundExternalUrl } from "@/lib/fund/url";
import { useUnifiedActivityLogs } from "@/lib/mikkeos/activity-client-store";

const projectTypes = Object.keys(fundProjectTypeLabels) as FundProjectType[];
const campaignTypes = Object.keys(fundCampaignTypeLabels) as FundCampaignType[];
const goalTypes = Object.keys(fundGoalTypeLabels) as FundGoalType[];
const statuses = Object.keys(fundProjectStatusLabels) as FundProjectStatus[];
const visibilities = Object.keys(fundVisibilityLabels) as FundVisibility[];

function emptyPlan(index: number): FundPlanInput {
  return {
    title: "",
    description: "",
    imageUrl: "",
    planType: "support",
    price: null,
    quantityLimit: null,
    perPersonLimit: 1,
    deliveryDate: "",
    externalPaymentUrl: "",
    externalApplicationUrl: "",
    requiredInformationNote: "",
    requiresShipping: false,
    status: "active",
    sortOrder: index
  };
}

export function FundProjectForm({ project, projectPlans = [] }: { project?: FundProject; projectPlans?: FundPlanInput[] }) {
  const router = useRouter();
  const { profile } = useAuth();
  const { challengeRecords, prepareProject, saveProject, prepareProjectPlans, saveProjectPlans } = useFundProjects();
  const { addLog, removeLog } = useUnifiedActivityLogs();
  const [title, setTitle] = useState(project?.title ?? "");
  const [shortDescription, setShortDescription] = useState(project?.shortDescription ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [projectType, setProjectType] = useState<FundProjectType>(project?.projectType ?? "product");
  const [campaignType, setCampaignType] = useState<FundCampaignType>(project?.campaignType ?? "preorder");
  const [stage, setStage] = useState<FundStage>(project?.stage ?? "concept");
  const [status, setStatus] = useState<FundProjectStatus>(project?.status ?? "draft");
  const [visibility, setVisibility] = useState<FundVisibility>(project?.visibility ?? "private");
  const [coverImageUrl, setCoverImageUrl] = useState(project?.coverImageUrl ?? "");
  const [goalType, setGoalType] = useState<FundGoalType>(project?.goalType ?? "supporters");
  const [goalValue, setGoalValue] = useState(project?.goalValue ? String(project.goalValue) : "");
  const [displayAmount, setDisplayAmount] = useState(project?.displayAmount ?? false);
  const [startAt, setStartAt] = useState(project?.startAt ?? "");
  const [endAt, setEndAt] = useState(project?.endAt ?? "");
  const [externalPaymentUrl, setExternalPaymentUrl] = useState(project?.externalPaymentUrl ?? "");
  const [externalApplicationUrl, setExternalApplicationUrl] = useState(project?.externalApplicationUrl ?? "");
  const [whyNow, setWhyNow] = useState(project?.whyNow ?? "");
  const [audience, setAudience] = useState(project?.audience ?? "");
  const [useOfSupport, setUseOfSupport] = useState(project?.useOfSupport ?? "");
  const [schedule, setSchedule] = useState(project?.schedule ?? "");
  const [riskNotes, setRiskNotes] = useState(project?.riskNotes ?? "");
  const [cancellationPolicy, setCancellationPolicy] = useState(project?.cancellationPolicy ?? "");
  const [contactNote, setContactNote] = useState(project?.contactNote ?? "");
  const [plans, setPlans] = useState<FundPlanInput[]>(projectPlans.length > 0 ? projectPlans : [emptyPlan(0)]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const hasInvalidUrl = useMemo(() => {
    return [
      coverImageUrl,
      externalPaymentUrl,
      externalApplicationUrl,
      ...plans.flatMap((plan) => [plan.imageUrl, plan.externalPaymentUrl, plan.externalApplicationUrl])
    ].some((value) => !isValidFundExternalUrl(value));
  }, [coverImageUrl, externalApplicationUrl, externalPaymentUrl, plans]);

  const canSave = title.trim().length > 0 && Number(goalValue) > 0 && !hasInvalidUrl && !saving;

  function updatePlan(index: number, patch: Partial<FundPlanInput>) {
    setPlans((current) => current.map((plan, planIndex) => (planIndex === index ? { ...plan, ...patch } : plan)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!canSave) {
      setMessage(hasInvalidUrl ? "外部リンクは https:// または http:// から入力してください。" : "必須項目を確認してください。");
      return;
    }
    setSaving(true);

    const cleanPlans = plans
      .filter((plan) => plan.title.trim().length > 0)
      .map((plan, index) => ({
        ...plan,
        title: plan.title.trim(),
        description: plan.description.trim(),
        imageUrl: normalizeFundExternalUrl(plan.imageUrl),
        externalPaymentUrl: normalizeFundExternalUrl(plan.externalPaymentUrl),
        externalApplicationUrl: normalizeFundExternalUrl(plan.externalApplicationUrl),
        requiredInformationNote: plan.requiredInformationNote.trim(),
        sortOrder: index
      }));

    const payload = {
      profileSlug: profile.handle || project?.profileSlug || "ayumi",
      slug: project?.slug ?? makeProjectSlug(title),
      title: title.trim(),
      shortDescription: shortDescription.trim(),
      description: description.trim(),
      projectType,
      campaignType,
      stage,
      status,
      visibility,
      coverImageUrl: normalizeFundExternalUrl(coverImageUrl),
      goalType,
      goalValue: Number(goalValue),
      displayAmount,
      startAt,
      endAt,
      externalPaymentUrl: normalizeFundExternalUrl(externalPaymentUrl),
      externalApplicationUrl: normalizeFundExternalUrl(externalApplicationUrl),
      whyNow: whyNow.trim(),
      audience: audience.trim(),
      useOfSupport: useOfSupport.trim(),
      schedule: schedule.trim(),
      riskNotes: riskNotes.trim(),
      cancellationPolicy: cancellationPolicy.trim(),
      contactNote: contactNote.trim()
    };

    const nextProject = prepareProject(payload, project);
    const nextPlans = prepareProjectPlans(nextProject.id, cleanPlans);

    try {
      await saveFundProjectContent({
        ownerProfileId: profile.id,
        project: nextProject,
        plans: nextPlans
      });
      saveProject(nextProject);
      saveProjectPlans(nextProject.id, nextPlans);
      syncPublishedActivity(nextProject);
      router.replace(`/apps/fund/${nextProject.id}/edit`);
      if (project) setMessage("保存しました。");
    } catch {
      setMessage("保存できませんでした。時間をおいて、もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  function syncPublishedActivity(nextProject: FundProject) {
    if (nextProject.visibility !== "private" && nextProject.status !== "draft") {
      addLog(createFundPublishedActivity(nextProject));
      const challengeRecord = challengeRecords.find((record) => record.projectId === nextProject.id);
      if (challengeRecord && nextProject.visibility === "public") {
        addLog(createFundCompletedActivity(nextProject, challengeRecord));
      } else {
        removeLog("fund", nextProject.id, "fund_project_completed");
      }
    } else {
      removeLog("fund", nextProject.id, "fund_project_published");
      removeLog("fund", nextProject.id, "fund_project_completed");
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl">
      <MikkeSection title="何を実現したいですか？">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="プロジェクト名" required className="sm:col-span-2">
            <input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} required />
          </Field>
          <Field label="プロジェクトの種類">
            <select value={projectType} onChange={(event) => setProjectType(event.target.value as FundProjectType)} className={inputClass}>
              {projectTypes.map((type) => <option key={type} value={type}>{fundProjectTypeLabels[type]}</option>)}
            </select>
          </Field>
          <Field label="募集の方法">
            <select value={campaignType} onChange={(event) => setCampaignType(event.target.value as FundCampaignType)} className={inputClass}>
              {campaignTypes.map((type) => <option key={type} value={type}>{fundCampaignTypeLabels[type]}</option>)}
            </select>
          </Field>
          <Field label="短い説明" className="sm:col-span-2">
            <textarea value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} rows={2} className={textareaClass} />
          </Field>
          <Field label="何を実現したいですか？" className="sm:col-span-2">
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className={textareaClass} />
          </Field>
          <Field label="なぜ今、始めたいですか？" className="sm:col-span-2">
            <textarea value={whyNow} onChange={(event) => setWhyNow(event.target.value)} rows={3} className={textareaClass} />
          </Field>
          <Field label="誰のための企画ですか？" className="sm:col-span-2">
            <textarea value={audience} onChange={(event) => setAudience(event.target.value)} rows={3} className={textareaClass} />
          </Field>
        </div>
      </MikkeSection>

      <MikkeSection title="どこを目標にしますか？">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="目標の種類">
            <select
              value={goalType}
              onChange={(event) => {
                const nextGoalType = event.target.value as FundGoalType;
                setGoalType(nextGoalType);
                if (nextGoalType !== "amount") setDisplayAmount(false);
              }}
              className={inputClass}
            >
              {goalTypes.map((type) => <option key={type} value={type}>{fundGoalTypeLabels[type]}</option>)}
            </select>
          </Field>
          <Field label="目標値" required>
            <input value={goalValue} onChange={(event) => setGoalValue(event.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputClass} required />
          </Field>
          <Field label="募集開始日">
            <input value={startAt} onChange={(event) => setStartAt(event.target.value)} type="date" className={inputClass} />
          </Field>
          <Field label="募集終了日">
            <input value={endAt} onChange={(event) => setEndAt(event.target.value)} type="date" className={inputClass} />
          </Field>
          {goalType === "amount" ? (
            <label className="flex items-center gap-2 text-sm font-semibold text-[var(--mikke-text)] sm:col-span-2">
              <input type="checkbox" checked={displayAmount} onChange={(event) => setDisplayAmount(event.target.checked)} />
              公開ページに金額を表示する
            </label>
          ) : null}
        </div>
      </MikkeSection>

      <MikkeSection title="応援で何が変わりますか？">
        <div className="grid gap-4">
          <Field label="応援によって実現できること">
            <textarea value={useOfSupport} onChange={(event) => setUseOfSupport(event.target.value)} rows={4} className={textareaClass} />
          </Field>
          <Field label="これからの予定">
            <textarea value={schedule} onChange={(event) => setSchedule(event.target.value)} rows={4} className={textareaClass} />
          </Field>
          <Field label="リスク・変更の可能性">
            <textarea value={riskNotes} onChange={(event) => setRiskNotes(event.target.value)} rows={3} className={textareaClass} />
          </Field>
          <Field label="延期・中止時の対応">
            <textarea value={cancellationPolicy} onChange={(event) => setCancellationPolicy(event.target.value)} rows={3} className={textareaClass} />
          </Field>
          <Field label="問い合わせ方法">
            <textarea value={contactNote} onChange={(event) => setContactNote(event.target.value)} rows={2} className={textareaClass} />
          </Field>
        </div>
      </MikkeSection>

      <MikkeSection title="応援方法">
        <div className="space-y-4">
          {plans.map((plan, index) => (
            <div key={plan.id ?? `new-${index}`} className="border-t border-[var(--mikke-line)] pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold">応援プラン {index + 1}</p>
                {plans.length > 1 ? (
                  <button type="button" onClick={() => setPlans((current) => current.filter((_, planIndex) => planIndex !== index))} className="grid h-9 w-9 place-items-center text-[var(--mikke-danger)]" aria-label="応援プランを削除">
                    <Trash2 size={17} />
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="プラン名" className="sm:col-span-2">
                  <input value={plan.title} onChange={(event) => updatePlan(index, { title: event.target.value })} className={inputClass} />
                </Field>
                <Field label="説明" className="sm:col-span-2">
                  <textarea value={plan.description} onChange={(event) => updatePlan(index, { description: event.target.value })} rows={3} className={textareaClass} />
                </Field>
                <Field label="金額（任意）">
                  <input value={plan.price ?? ""} onChange={(event) => updatePlan(index, { price: event.target.value ? Number(event.target.value.replace(/\D/g, "")) : null })} inputMode="numeric" className={inputClass} />
                </Field>
                <Field label="受付上限（任意）">
                  <input value={plan.quantityLimit ?? ""} onChange={(event) => updatePlan(index, { quantityLimit: event.target.value ? Number(event.target.value.replace(/\D/g, "")) : null })} inputMode="numeric" className={inputClass} />
                </Field>
                <Field label="外部申込URL" className="sm:col-span-2">
                  <input value={plan.externalApplicationUrl} onChange={(event) => updatePlan(index, { externalApplicationUrl: event.target.value })} placeholder="https://..." className={inputClass} />
                </Field>
                <Field label="外部決済URL" className="sm:col-span-2">
                  <input value={plan.externalPaymentUrl} onChange={(event) => updatePlan(index, { externalPaymentUrl: event.target.value })} placeholder="https://..." className={inputClass} />
                </Field>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setPlans((current) => [...current, emptyPlan(current.length)])} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]">
            <Plus size={16} /> 応援プランを追加
          </button>
        </div>
      </MikkeSection>

      <MikkeSection title="どのように案内しますか？">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="プロジェクトの段階">
            <select value={stage} onChange={(event) => setStage(event.target.value as FundStage)} className={inputClass}>
              <option value="concept">構想</option><option value="campaign">募集</option><option value="realization">実現</option>
            </select>
          </Field>
          <Field label="状態">
            <select value={status} onChange={(event) => setStatus(event.target.value as FundProjectStatus)} className={inputClass}>
              {statuses.map((item) => <option key={item} value={item}>{fundProjectStatusLabels[item]}</option>)}
            </select>
          </Field>
          <Field label="公開範囲">
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as FundVisibility)} className={inputClass}>
              {visibilities.map((item) => <option key={item} value={item}>{fundVisibilityLabels[item]}</option>)}
            </select>
          </Field>
          <Field label="メイン画像URL">
            <input value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} placeholder="https://..." className={inputClass} />
          </Field>
          <Field label="プロジェクト共通の外部申込URL" className="sm:col-span-2">
            <input value={externalApplicationUrl} onChange={(event) => setExternalApplicationUrl(event.target.value)} placeholder="https://..." className={inputClass} />
          </Field>
          <Field label="プロジェクト共通の外部決済URL" className="sm:col-span-2">
            <input value={externalPaymentUrl} onChange={(event) => setExternalPaymentUrl(event.target.value)} placeholder="https://..." className={inputClass} />
          </Field>
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--mikke-muted)]">現在の公開URLは、この端末内で表示を確認するためのものです。別端末への共有はまだできません。</p>
      </MikkeSection>

      {hasInvalidUrl ? <p className="mb-3 text-sm font-bold text-[var(--mikke-danger)]">外部リンクは https:// または http:// から入力してください。</p> : null}
      {message ? <p className="mb-3 text-sm font-bold text-[var(--mikke-primary)]">{message}</p> : null}
      <button type="submit" disabled={!canSave} className="w-full rounded-lg bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
        {saving ? "保存しています…" : project ? "変更を保存" : "Fundを作成"}
      </button>
    </form>
  );
}

const inputClass = "mt-1.5 w-full rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";
const textareaClass = `${inputClass} resize-none`;

function Field({ label, required = false, className = "", children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-bold text-[var(--mikke-text)]">{label}{required ? <span className="ml-1 text-[var(--mikke-accent)]">*</span> : null}</span>
      {children}
    </label>
  );
}

function makeProjectSlug(title: string) {
  const ascii = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return ascii || `project-${Date.now()}`;
}
