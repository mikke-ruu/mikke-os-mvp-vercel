"use client";

import { MessageSquare, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { TeamWorksOperationsShell } from "@/components/team-works/operations/TeamWorksOperationsShell";
import { supabase } from "@/lib/supabase/client";
import {
  loadOperationsMessagesOverview,
  type OperationsMessagesOverview
} from "@/lib/team-works-operations";

function TeamWorksMessagesContent() {
  const [data, setData] = useState<OperationsMessagesOverview | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await loadOperationsMessagesOverview(supabase));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "メッセージを読み込めませんでした。");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <TeamWorksOperationsShell title="メッセージ管理" subtitle="全プロジェクトの連絡先と新着メッセージ">
      {error ? <MikkeEmptyState title="読み込みに失敗しました" helper={error} /> : !data ? (
        <p className="text-sm font-semibold text-[var(--mikke-muted)]">読み込み中…</p>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)]">
          <MikkeSection title="プロジェクト" tone="editorial">
            {data.projects.length === 0 ? <MikkeEmptyState title="プロジェクトはありません" /> : (
              <div className="grid gap-2">
                {data.projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/apps/team-works/projects/${project.id}?tab=messages`}
                    className="flex items-center gap-3 rounded-xl border border-[var(--mikke-line)] bg-white p-3 transition hover:border-[var(--mikke-primary)]"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: project.bg, color: project.fg }}>
                      <MessageSquare size={16} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{project.title}</span>
                    <span className="text-xs font-bold text-[var(--mikke-primary)]">開く</span>
                  </Link>
                ))}
              </div>
            )}
          </MikkeSection>

          <MikkeSection title="新着メッセージ" tone="editorial">
            {data.recentComments.length === 0 ? <MikkeEmptyState title="新着メッセージはありません" /> : (
              <div className="divide-y divide-[var(--mikke-line)] overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
                {data.recentComments.map((comment) => (
                  <Link
                    key={comment.id}
                    href={`/apps/team-works/projects/${comment.projectId}?tab=messages`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--mikke-surface-soft)]"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]"><Users size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-extrabold">{comment.authorName}（{comment.projectTitle}）</span>
                      <span className="mt-1 block truncate text-xs font-semibold text-[var(--mikke-muted)]">{comment.body}</span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-[var(--mikke-muted-light)]">{formatRelativeTime(comment.createdAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </MikkeSection>
        </div>
      )}
    </TeamWorksOperationsShell>
  );
}

function formatRelativeTime(iso: string) {
  const diffMinutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (diffMinutes < 1) return "たった今";
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}時間前`;
  return `${Math.floor(diffHours / 24)}日前`;
}

export default function TeamWorksMessagesPage() {
  return <AuthGate><TeamWorksMessagesContent /></AuthGate>;
}
