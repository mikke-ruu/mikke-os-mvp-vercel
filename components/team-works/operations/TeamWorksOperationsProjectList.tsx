"use client";

import { FolderKanban, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { supabase } from "@/lib/supabase/client";
import { createOperationsProject } from "@/lib/team-works-operations-project";
import { fetchOperationsProjects, formatDateKey, type OperationsProjectSummary } from "@/lib/team-works-operations";

export function TeamWorksOperationsProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState<OperationsProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [contractStartedOn, setContractStartedOn] = useState(formatDateKey(new Date()));
  const [contractEndedOn, setContractEndedOn] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await fetchOperationsProjects(supabase);
      setProjects(result.projects);
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
        organizationName: "日本語レッスン",
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
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--mikke-green)]"><Plus size={19} /></span>
          <div>
            <h2 className="text-base font-extrabold">日本語レッスンのプロジェクトを立ち上げる</h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">テンプレート選択は保留し、必要な基本情報だけで始められます。</p>
          </div>
        </div>
        <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_180px_auto] md:items-end">
          <label className="block text-xs font-bold">プロジェクト名
            <input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="例：スリランカ校" className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-primary)]" />
          </label>
          <label className="block text-xs font-bold">契約開始日
            <input type="date" value={contractStartedOn} onChange={(event) => setContractStartedOn(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm" />
          </label>
          <label className="block text-xs font-bold">契約終了日
            <input type="date" value={contractEndedOn} min={contractStartedOn || undefined} onChange={(event) => setContractEndedOn(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm" />
          </label>
          <button type="submit" disabled={saving || !title.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            <Plus size={16} /> {saving ? "作成中…" : "作成"}
          </button>
        </form>
      </section>

    <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--mikke-primary)]">Operations</p>
          <h2 className="mt-1 text-base font-extrabold">運営型プロジェクト</h2>
          <p className="mt-1 text-xs leading-5 font-semibold text-[var(--mikke-muted)]">
            契約期間中、予定・名簿・シフト・報告を繰り返し運営するプロジェクトです。
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>
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
              className="flex items-center gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 transition hover:border-[var(--mikke-primary)]"
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
    </div>
  );
}
