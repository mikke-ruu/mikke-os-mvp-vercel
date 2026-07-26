"use client";

import { CalendarDays, FolderKanban, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { supabase } from "@/lib/supabase/client";
import { fetchOperationsProjects, type OperationsProjectSummary } from "@/lib/team-works-operations";

export function TeamWorksOperationsProjectList() {
  const [projects, setProjects] = useState<OperationsProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--mikke-primary)]">Operations</p>
          <h2 className="mt-1 text-base font-extrabold">運営型プロジェクト</h2>
          <p className="mt-1 text-xs leading-5 font-semibold text-[var(--mikke-muted)]">
            契約期間中、予定・名簿・シフト・報告を繰り返し運営するプロジェクトです。
          </p>
        </div>
        <Link
          href="/apps/team-works"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]"
        >
          <CalendarDays size={15} /> 本部を開く
        </Link>
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
  );
}
