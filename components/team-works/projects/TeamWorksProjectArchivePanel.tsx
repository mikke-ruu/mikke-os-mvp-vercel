"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { archiveTeamWorksProject } from "@/lib/team-works-operations";
import { teamWorksProjectInputClass } from "./TeamWorksProjectsShell";

// 運営型・納品型どちらのプロジェクト設定タブからも使う共通のアーカイブUI。
// 物理削除はしない(archived_atを立てるだけ)。誤操作防止のため、
// プロジェクト名を正しく入力しないとボタンが押せない。
export function TeamWorksProjectArchivePanel({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canArchive = confirmText.trim() === projectTitle.trim();

  async function archive() {
    if (!canArchive) return;
    setSaving(true);
    setError("");
    try {
      await archiveTeamWorksProject(supabase, projectId);
      router.push("/apps/team-works/projects");
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "アーカイブできませんでした。");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl rounded-2xl border border-[var(--tw-action)] bg-white p-5">
      <p className="flex items-center gap-2 text-sm font-extrabold text-[var(--tw-action)]">
        <AlertTriangle size={16} /> このプロジェクトをアーカイブする
      </p>
      <p className="mt-2 text-xs leading-5 font-semibold text-[var(--mikke-muted)]">
        一覧から見えなくなります。工程・提出物・やり取りは消えません。あとで元に戻せます
        (プロジェクト管理ページの「アーカイブ済み」から復元できます)。
      </p>
      <label className="mt-4 block text-xs font-bold">
        確認のため、プロジェクト名「{projectTitle}」を入力してください
        <input
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder={projectTitle}
          className={teamWorksProjectInputClass}
        />
      </label>
      {error ? <p role="alert" className="mt-2 rounded-lg border border-[var(--tw-action)] px-3 py-2 text-xs font-bold text-[var(--tw-action)]">{error}</p> : null}
      <button
        type="button"
        onClick={() => void archive()}
        disabled={!canArchive || saving}
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--tw-action)] px-4 py-2.5 text-sm font-bold text-[var(--tw-on-solid)] disabled:bg-[var(--mikke-line)] disabled:text-[var(--mikke-muted)]"
      >
        {saving ? "アーカイブしています…" : "アーカイブする"}
      </button>
    </div>
  );
}
