"use client";

import { ChevronRight, RefreshCcw, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { supabase } from "@/lib/supabase/client";
import { loadOperationsScheduleGroups, type OperationsScheduleGroup } from "@/lib/team-works-operations";

type GenerateStatus =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; createdCount: number; projectCount: number }
  | { kind: "error"; message: string };

export function TeamWorksScheduleList() {
  const [groups, setGroups] = useState<OperationsScheduleGroup[] | null>(null);
  const [hasOperationsProjects, setHasOperationsProjects] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generateStatus, setGenerateStatus] = useState<GenerateStatus>({ kind: "idle" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadOperationsScheduleGroups(supabase);
      setGroups(result.groups);
      setHasOperationsProjects(result.hasOperationsProjects);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "スケジュールの読み込みに失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGenerate = useCallback(async () => {
    setGenerateStatus({ kind: "running" });
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("ログインが必要です。");

      const response = await fetch("/api/team-works/operations/generate-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ weeksAhead: 4 })
      });
      const payload = (await response.json()) as { error?: string; totalCreated?: number; projectCount?: number };
      if (!response.ok) throw new Error(payload.error ?? "コマの生成に失敗しました。");
      setGenerateStatus({ kind: "done", createdCount: payload.totalCreated ?? 0, projectCount: payload.projectCount ?? 0 });
      await load();
    } catch (generateError) {
      setGenerateStatus({ kind: "error", message: generateError instanceof Error ? generateError.message : "コマの生成に失敗しました。" });
    }
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-xs leading-6 text-[var(--mikke-muted)]">
          全プロジェクトの予定を時系列で表示します。カードをタップで該当プロジェクトへ。
        </p>
        <div className="shrink-0">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generateStatus.kind === "running"}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-60"
          >
            <RefreshCcw size={14} className={generateStatus.kind === "running" ? "animate-spin" : ""} />
            次の4週間分のコマを生成
          </button>
          {generateStatus.kind === "done" ? (
            <p className="mt-1 text-right text-[11px] font-semibold text-[var(--mikke-success)]">
              {generateStatus.projectCount}プロジェクトで{generateStatus.createdCount}件のコマを追加しました。
            </p>
          ) : null}
          {generateStatus.kind === "error" ? (
            <p className="mt-1 text-right text-[11px] font-semibold text-[var(--mikke-danger)]">{generateStatus.message}</p>
          ) : null}
        </div>
      </div>

      {loading && !groups ? (
        <p className="text-sm text-[var(--mikke-muted)]">読み込んでいます…</p>
      ) : error ? (
        <MikkeEmptyState title="読み込みに失敗しました" helper={error} />
      ) : !hasOperationsProjects ? (
        <MikkeEmptyState
          title="運営型プロジェクトがまだありません"
          helper="契約期間で回るプロジェクトを作成すると、ここに時系列でスケジュールが表示されます。"
        />
      ) : !groups || groups.length === 0 ? (
        <MikkeEmptyState title="今後の予定はまだありません" helper="週次パターンを設定し、上のボタンでコマを生成してください。" />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.dateKey}>
              <p className="mb-1.5 ml-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--mikke-muted-light)]">{group.label}</p>
              <div className="divide-y divide-[var(--mikke-line)] rounded-xl border border-[var(--mikke-line)] bg-white">
                {group.events.map((event) => (
                  <Link
                    key={event.id}
                    href={`/apps/team-works/projects/${event.projectId}`}
                    className="flex items-center gap-3 px-3 py-3"
                  >
                    <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: event.bg }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {event.startTime}〜{addMinutes(event.startTime, event.durationMin)}　{event.projectTitle}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-[var(--mikke-muted)]">
                        {event.partnerName ? <span>担当 {event.partnerName}</span> : <span className="text-[var(--mikke-accent)]">担当未定</span>}
                        {event.participantCount > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Users size={12} /> {event.participantCount}名
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-[var(--mikke-muted-light)]" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function addMinutes(startTime: string, durationMin: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const total = hours * 60 + minutes + durationMin;
  const endHours = Math.floor(total / 60) % 24;
  const endMinutes = total % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}
