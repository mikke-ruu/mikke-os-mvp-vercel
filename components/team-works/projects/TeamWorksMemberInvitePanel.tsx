"use client";

import { CheckCircle2, Clipboard, LoaderCircle, MailPlus, UserPlus } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { createTeamWorksMemberInvite, type TeamWorksInviteRole } from "@/lib/team-works-database";
import type { TeamWorksProjectStoreState } from "@/lib/team-works-projects";
import { teamWorksProjectInputClass, TeamWorksProjectField } from "./TeamWorksProjectsShell";

export function TeamWorksMemberInvitePanel({ projectState }: { projectState: TeamWorksProjectStoreState }) {
  const { profile } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamWorksInviteRole>("worker");
  const [projectId, setProjectId] = useState(projectState.projects[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");

  async function createInvite() {
    if (!email.trim() || !projectId) return;
    setBusy(true);
    setMessage("");
    setInviteUrl("");
    try {
      const invite = await createTeamWorksMemberInvite({
        displayName: profile.display_name,
        projectSourceId: projectId,
        email,
        role
      });
      const url = new URL(`/apps/team-works/invite/${invite.id}`, window.location.origin);
      url.searchParams.set("organization", invite.organization_id);
      url.searchParams.set("role", invite.role);
      setInviteUrl(url.toString());
      setMessage(`招待リンクを作成しました。有効期限は${formatDate(invite.expires_at)}です。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "招待リンクを作成できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setMessage("招待リンクをコピーしました。");
  }

  return (
    <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 sm:p-5" aria-labelledby="team-works-member-invite-title">
      <div className="flex items-center gap-2">
        <MailPlus size={18} className="text-[var(--mikke-primary)]" />
        <h2 id="team-works-member-invite-title" className="text-sm font-bold">実ユーザーを案件へ招待</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">
        相手が同じメールアドレスでログインした場合だけ、招待先の組織と案件へ参加できます。先に案件をDBへ同期してください。
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <TeamWorksProjectField label="招待する案件" required>
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className={teamWorksProjectInputClass}>
            {projectState.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </TeamWorksProjectField>
        <TeamWorksProjectField label="メールアドレス" required>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={teamWorksProjectInputClass} placeholder="member@example.com" />
        </TeamWorksProjectField>
        <TeamWorksProjectField label="役割" required>
          <select value={role} onChange={(event) => setRole(event.target.value as TeamWorksInviteRole)} className={teamWorksProjectInputClass}>
            <option value="worker">担当メンバー</option>
            <option value="client_user">クライアント</option>
            <option value="manager">管理者</option>
          </select>
        </TeamWorksProjectField>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={createInvite} disabled={busy || !email.trim() || !projectId} className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
          {busy ? <LoaderCircle size={15} className="animate-spin" /> : <UserPlus size={15} />} 招待リンクを作成
        </button>
        {inviteUrl ? <button type="button" onClick={copyInvite} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold"><Clipboard size={15} /> リンクをコピー</button> : null}
      </div>
      {inviteUrl ? <input readOnly value={inviteUrl} aria-label="招待リンク" className={`${teamWorksProjectInputClass} font-mono text-xs`} /> : null}
      {message ? <p role="status" className="mt-3 flex items-start gap-2 text-xs font-bold leading-5 text-[var(--mikke-muted)]"><CheckCircle2 size={15} className="mt-0.5 shrink-0" />{message}</p> : null}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric" }).format(new Date(value));
}
