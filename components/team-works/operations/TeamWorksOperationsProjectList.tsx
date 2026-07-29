"use client";

import { ArrowRight, FileCheck2, FolderKanban, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { supabase } from "@/lib/supabase/client";
import { createOperationsProject } from "@/lib/team-works-operations-project";
import { fetchOperationsProjects, formatDateKey, type OperationsProjectSummary } from "@/lib/team-works-operations";
import { fetchDeliveryProjects, fetchStepTemplates, type DeliveryProjectSummary, type DeliveryStepTemplate } from "@/lib/team-works-delivery";

export function TeamWorksOperationsProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState<OperationsProjectSummary[] | null>(null);
  const [deliveryProjects, setDeliveryProjects] = useState<DeliveryProjectSummary[] | null>(null);
  const [templates, setTemplates] = useState<DeliveryStepTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [contractStartedOn, setContractStartedOn] = useState(formatDateKey(new Date()));
  const [contractEndedOn, setContractEndedOn] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [result, deliveryResult, templateResult] = await Promise.all([
        fetchOperationsProjects(supabase),
        fetchDeliveryProjects(supabase),
        fetchStepTemplates(supabase)
      ]);
      setProjects(result.projects);
      setDeliveryProjects(deliveryResult);
      setTemplates(templateResult);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "運営型プロジェクトの読み込みに失敗しました。");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const projectId = await createOperationsProject(supabase, {
        organizationName,
        title,
        contractStartedOn,
        contractEndedOn
      });
      router.push(`/apps/team-works/projects/${projectId}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "プロジェクトを作成できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--tw-done)] text-[var(--tw-on-tint)]"><Plus size={19} /></span>
          <div>
            <h2 className="text-base font-extrabold">運営型プロジェクトを立ち上げる</h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">テンプレート選択は保留し、必要な基本情報だけで始められます。</p>
          </div>
        </div>
        <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2 md:items-end">
          <label className="block text-xs font-bold">プロジェクト名
            <input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="例：渋谷教室、A社定期メンテナンス" className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--tw-action)]" />
          </label>
          <label className="block text-xs font-bold">組織名
            <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="例：株式会社◯◯、◯◯事務所" className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--tw-action)]" />
          </label>
          <label className="block text-xs font-bold">契約開始日
            <input type="date" value={contractStartedOn} onChange={(event) => setContractStartedOn(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm" />
          </label>
          <label className="block text-xs font-bold">契約終了日
            <input type="date" value={contractEndedOn} min={contractStartedOn || undefined} onChange={(event) => setContractEndedOn(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm" />
          </label>
          <button type="submit" disabled={saving || !title.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--tw-action)] px-4 py-2.5 text-sm font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)] md:col-span-2 md:w-fit">
            <Plus size={16} /> {saving ? "作成中…" : "作成"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--mikke-yellow)] text-[var(--tw-on-tint)]"><Plus size={19} /></span>
          <div>
            <h2 className="text-base font-extrabold">納品型プロジェクトを立ち上げる</h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
              期日までに成果物を仕上げる案件です。ゴール・メンバー・作業の順番を4ステップで決めます。
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs font-semibold text-[var(--mikke-muted)]">例）認定講座構築、サイト制作、教材制作</p>
        <Link
          href="/apps/team-works/projects/new"
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--tw-action)] px-4 py-2.5 text-sm font-bold text-[var(--tw-on-solid)]"
        >
          <Plus size={16} /> 作成をはじめる
        </Link>
      </section>

    <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--tw-title)]">Operations</p>
          <h2 className="mt-1 text-base font-extrabold">運営型プロジェクト</h2>
          <p className="mt-1 text-xs leading-5 font-semibold text-[var(--mikke-muted)]">
            契約期間中、予定・名簿・シフト・報告を繰り返し運営するプロジェクトです。
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p>
      ) : projects === null ? (
        <p className="mt-4 text-xs font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>
      ) : projects.length === 0 ? (
        <div className="mt-4">
          <MikkeEmptyState title="運営型プロジェクトはまだありません" />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/apps/team-works/projects/${project.id}`}
              className="flex items-center gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 transition hover:border-[var(--tw-done)]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: project.bg, color: project.fg }}>
                <FolderKanban size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">{project.title}</span>
                <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--mikke-muted)]">
                  <Users size={13} /> 運営型 · 詳細を開く
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>

    <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--tw-title)]">Delivery</p>
          <h2 className="mt-1 text-base font-extrabold">納品型プロジェクト</h2>
          <p className="mt-1 text-xs leading-5 font-semibold text-[var(--mikke-muted)]">
            期日までに成果物を仕上げる、期間限定の制作案件です。タスクの期日をカレンダーで確認できます。
          </p>
        </div>
      </div>

      {deliveryProjects === null ? (
        <p className="mt-4 text-xs font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>
      ) : deliveryProjects.length === 0 ? (
        <div className="mt-4">
          <MikkeEmptyState title="納品型プロジェクトはまだありません" />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {deliveryProjects.map((project) => (
            <Link
              key={project.id}
              href={`/apps/team-works/projects/${project.id}`}
              className="flex items-center gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 transition hover:border-[var(--tw-done)]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--mikke-yellow)] text-[var(--tw-on-tint)]">
                <FileCheck2 size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">{project.title}</span>
                <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--mikke-muted)]">
                  <Users size={13} /> 納品型 · 詳細を開く
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>

    <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--tw-title)]">Templates</p>
          <h2 className="mt-1 text-base font-extrabold">工程テンプレート</h2>
          <p className="mt-1 text-xs leading-5 font-semibold text-[var(--mikke-muted)]">
            納品型プロジェクトの工程構成をテンプレートとして保存しておくと、次の案件で読み込んでそのまま使えます。
          </p>
        </div>
        <Link href="/apps/team-works/project-templates" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--tw-action)] px-4 py-2.5 text-sm font-bold text-[var(--tw-on-solid)]">
          <Plus size={16} /> テンプレートを作る
        </Link>
      </div>

      {templates === null ? (
        <p className="mt-4 text-xs font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>
      ) : templates.length === 0 ? (
        <div className="mt-4">
          <MikkeEmptyState title="テンプレートはまだありません" helper="「テンプレートを作る」から自社の仕事の流れを登録してください。" />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {templates.map((template) => (
            <Link
              key={template.id}
              href="/apps/team-works/project-templates"
              className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 transition hover:border-[var(--tw-done)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">{template.name}</span>
                <span className="mt-1 block text-xs font-semibold text-[var(--mikke-muted)]">{template.steps.length}工程</span>
                {template.steps.length > 0 ? (
                  <ol className="mt-1.5 space-y-0.5">
                    {template.steps.slice(0, 3).map((step, index) => (
                      <li key={index} className="truncate text-xs text-[var(--mikke-muted)]">{index + 1}. {step.title}</li>
                    ))}
                    {template.steps.length > 3 ? <li className="text-xs text-[var(--mikke-muted)]">…他{template.steps.length - 3}件</li> : null}
                  </ol>
                ) : null}
              </span>
              <span className="shrink-0 text-xs font-bold text-[var(--tw-title)]">編集 <ArrowRight size={12} className="inline" /></span>
            </Link>
          ))}
        </div>
      )}
    </section>
    </div>
  );
}
