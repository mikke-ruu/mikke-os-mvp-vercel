"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Mail, UserCog } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { TeamWorksOperationsShell } from "@/components/team-works/operations/TeamWorksOperationsShell";
import { supabase } from "@/lib/supabase/client";
import {
  archiveOperationsOrganizationMember,
  loadOperationsOrganizationMembers,
  type OperationsOrganizationMemberEntry
} from "@/lib/team-works-operations-project";

function roleLabel(role: string) {
  if (role === "owner") return "オーナー";
  if (role === "manager") return "マネージャー";
  if (role === "client_user") return "クライアント";
  if (role === "worker") return "パートナー";
  return role;
}

function TeamWorksSettingsContent() {
  const [members, setMembers] = useState<OperationsOrganizationMemberEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMembers(await loadOperationsOrganizationMembers(supabase));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "組織メンバーを読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function archive(member: OperationsOrganizationMemberEntry) {
    if (!window.confirm(`${member.displayName}さん（${roleLabel(member.role)}）をアーカイブしますか？\n過去の予定・報告・支払などの記録は残ります。同じメールアドレスで新しい招待を受け直せるようになります。`)) return;
    setBusyId(member.id);
    setMessage("");
    setError("");
    try {
      await archiveOperationsOrganizationMember(supabase, member.id);
      setMessage(`${member.displayName}さんをアーカイブしました。`);
      await reload();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "アーカイブできませんでした。");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <TeamWorksOperationsShell title="企業設定" subtitle="組織メンバーの管理">
      <div className="space-y-5">
        <MikkeSection title="組織メンバー" tone="editorial">
          <p className="-mt-2 text-xs leading-6 text-[var(--mikke-muted)]">
            この組織に登録されている全メンバー（役割問わず）です。招待を受け直せない・ログインできないなどの不具合が出た場合、対象をアーカイブすると同じメールアドレスで新しい招待を受け直せます。過去の予定・報告・支払などの記録は保持されます。オーナーはアーカイブできません。
          </p>
          {message ? <p role="status" className="mt-3 text-xs font-bold text-[var(--mikke-primary)]">{message}</p> : null}
          {error ? <p role="alert" className="mt-3 text-xs font-bold text-red-600">{error}</p> : null}
          {loading ? (
            <p className="mt-4 text-sm font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>
          ) : members.length === 0 ? (
            <MikkeEmptyState title="組織メンバーはまだいません" />
          ) : (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {members.map((member) => (
                <article key={member.id} className="rounded-xl border border-[var(--mikke-line)] bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--mikke-green)] text-[#1b1b1f]">
                      <UserCog size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{member.displayName}</p>
                      {member.email ? (
                        <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-semibold text-[var(--mikke-muted)]">
                          <Mail size={13} /> {member.email}
                        </p>
                      ) : null}
                      <span className="mt-2 inline-block rounded-full bg-[var(--mikke-primary-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--mikke-primary)]">
                        {roleLabel(member.role)}
                      </span>
                    </div>
                    {member.role === "owner" ? null : (
                      <button
                        type="button"
                        disabled={busyId === member.id}
                        onClick={() => void archive(member)}
                        className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 disabled:opacity-50"
                      >
                        {busyId === member.id ? <LoaderCircle size={13} className="animate-spin" /> : "アーカイブ"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </MikkeSection>
      </div>
    </TeamWorksOperationsShell>
  );
}

export default function TeamWorksSettingsPage() {
  return (
    <AuthGate>
      <TeamWorksSettingsContent />
    </AuthGate>
  );
}
