"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { TeamWorksOperationsShell } from "@/components/team-works/operations/TeamWorksOperationsShell";
import { supabase } from "@/lib/supabase/client";
import {
  loadOperationsManualDirectory,
  updateOperationsManualSharingScope,
  type OperationsManualDirectoryEntry
} from "@/lib/team-works-operations-project";

function TeamWorksManualsContent() {
  const [manuals, setManuals] = useState<OperationsManualDirectoryEntry[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try { setManuals(await loadOperationsManualDirectory(supabase)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "マニュアルを読み込めませんでした。"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const groups = useMemo(() => {
    const grouped = new Map<string, { title: string; projectId: string; manuals: OperationsManualDirectoryEntry[] }>();
    for (const manual of manuals ?? []) {
      const current = grouped.get(manual.projectId) ?? { title: manual.projectTitle, projectId: manual.projectId, manuals: [] };
      current.manuals.push(manual);
      grouped.set(manual.projectId, current);
    }
    return [...grouped.values()];
  }, [manuals]);

  async function toggle(manual: OperationsManualDirectoryEntry) {
    setBusyId(manual.id);
    setError("");
    try {
      await updateOperationsManualSharingScope(supabase, manual.id, manual.sharingScope === "project" ? "organization" : "project");
      await load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "共有範囲を保存できませんでした。");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <TeamWorksOperationsShell title="マニュアル管理" subtitle="プロジェクト別マニュアルと、組織で再利用する共有マスター">
      <MikkeSection title="Manuals" tone="editorial">
        <p className="-mt-2 mb-4 text-xs leading-6 text-[var(--mikke-muted)]">
          「プロジェクト限定」はその校だけで使用し、「組織共有」は他プロジェクトへ複製して育てるマスターです。本文編集・新規追加は各プロジェクトのマニュアルタブで行います。
        </p>
        {error ? <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p> : null}
        {manuals === null ? <p className="text-sm text-[var(--mikke-muted)]">読み込み中…</p> : groups.length === 0 ? (
          <MikkeEmptyState title="マニュアルはまだありません" helper="プロジェクト詳細の「マニュアル」から追加してください。" />
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.projectId} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-extrabold">{group.title}</h2>
                  <Link href={`/apps/team-works/projects/${group.projectId}?tab=manuals`} className="text-xs font-bold text-[var(--mikke-primary)]">編集・追加</Link>
                </div>
                <div className="divide-y divide-[var(--mikke-line)]">
                  {group.manuals.map((manual) => (
                    <div key={manual.id} className="flex items-center gap-3 py-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--mikke-surface-soft)] text-xs font-extrabold">{manual.no}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{manual.title}</span>
                      <label className="inline-flex shrink-0 items-center gap-2 text-xs font-bold">
                        <input type="checkbox" checked={manual.sharingScope === "organization"} disabled={busyId === manual.id} onChange={() => void toggle(manual)} />
                        組織共有
                      </label>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </MikkeSection>
    </TeamWorksOperationsShell>
  );
}

export default function TeamWorksManualsPage() {
  return (
    <AuthGate>
      <TeamWorksManualsContent />
    </AuthGate>
  );
}
