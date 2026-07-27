"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Archive, LoaderCircle, Mail, PauseCircle, PlayCircle, UserPlus, Users } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { TeamWorksOperationsShell } from "@/components/team-works/operations/TeamWorksOperationsShell";
import { TeamWorksPortalUrlCard } from "@/components/team-works/operations/TeamWorksPortalUrlCard";
import { TeamWorksProjectField, teamWorksProjectInputClass } from "@/components/team-works/projects/TeamWorksProjectsShell";
import { supabase } from "@/lib/supabase/client";
import {
  archiveOperationsPartner,
  createOperationsPartner,
  loadOperationsPartnerDirectory,
  updateOperationsPartnerStatus,
  type OperationsPartnerDirectoryEntry
} from "@/lib/team-works-operations-project";

function TeamWorksPartnersContent() {
  const [partners, setPartners] = useState<OperationsPartnerDirectoryEntry[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyPartnerId, setBusyPartnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPartners(await loadOperationsPartnerDirectory(supabase));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "パートナー名簿を読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await createOperationsPartner(supabase, { displayName, email, note });
      setDisplayName("");
      setEmail("");
      setNote("");
      setMessage("パートナー名簿に登録しました。各プロジェクトの「パートナー・シフト」から招待できます。");
      await reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "パートナーを登録できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  async function togglePause(partner: OperationsPartnerDirectoryEntry) {
    setBusyPartnerId(partner.id);
    setError("");
    setMessage("");
    try {
      await updateOperationsPartnerStatus(supabase, partner.id, partner.status === "active" ? "paused" : "active");
      setMessage(partner.status === "active" ? `${partner.displayName} さんを一時停止しました。` : `${partner.displayName} さんの一時停止を解除しました。`);
      await reload();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "状態を変更できませんでした。");
    } finally {
      setBusyPartnerId(null);
    }
  }

  async function archive(partner: OperationsPartnerDirectoryEntry) {
    if (!window.confirm(`${partner.displayName}さんを名簿からアーカイブしますか？\nこのプロジェクトへの割り当ては解除されませんが、既に開通しているポータルへのアクセスも止まります。過去の記録は残ります。`)) return;
    setBusyPartnerId(partner.id);
    setError("");
    setMessage("");
    try {
      await archiveOperationsPartner(supabase, partner.id);
      setMessage(`${partner.displayName} さんをアーカイブしました。`);
      await reload();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "アーカイブできませんでした。");
    } finally {
      setBusyPartnerId(null);
    }
  }

  return (
    <TeamWorksOperationsShell title="パートナー管理" subtitle="組織全体のパートナー名簿">
      <div className="space-y-5">
        <TeamWorksPortalUrlCard
          title="パートナー用ポータルURL"
          path="/apps/team-works/portal/worker"
          description="名簿に登録したパートナーには、このURLだけを渡します。相手はここでログイン（初めての方は新規登録）すると、登録メールと一致していればポータルが開きます。プロジェクトに割り当てると、ポータル内に承認のお知らせが届きます。"
        />
        <MikkeSection title="Partner Directory" tone="editorial">
          <form onSubmit={submit} className="grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr_auto] lg:items-end">
            <TeamWorksProjectField label="パートナー名" required>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className={teamWorksProjectInputClass}
                placeholder="表示名"
              />
            </TeamWorksProjectField>
            <TeamWorksProjectField label="メールアドレス" required>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={teamWorksProjectInputClass}
                placeholder="partner@example.com"
              />
            </TeamWorksProjectField>
            <TeamWorksProjectField label="メモ">
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className={teamWorksProjectInputClass}
                placeholder="得意領域・連絡メモ"
              />
            </TeamWorksProjectField>
            <button
              type="submit"
              disabled={busy || !displayName.trim() || !email.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy ? <LoaderCircle size={15} className="animate-spin" /> : <UserPlus size={15} />}
              登録
            </button>
          </form>
          {message ? <p role="status" className="mt-3 text-xs font-bold text-[var(--mikke-primary)]">{message}</p> : null}
          {error ? <p role="alert" className="mt-3 text-xs font-bold text-red-600">{error}</p> : null}
        </MikkeSection>

        <MikkeSection title="Partners" tone="editorial">
          {loading ? (
            <p className="text-sm font-semibold text-[var(--mikke-muted)]">読み込んでいます…</p>
          ) : partners.length === 0 ? (
            <MikkeEmptyState title="登録済みパートナーはまだいません" helper="先にここで名簿登録し、各プロジェクトからworker固定で招待します。" />
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {partners.map((partner) => (
                <article key={partner.id} className="rounded-xl border border-[var(--mikke-line)] bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--mikke-green)] text-[#1b1b1f]">
                      <Users size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{partner.displayName}</p>
                      <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-semibold text-[var(--mikke-muted)]">
                        <Mail size={13} /> {partner.email}
                      </p>
                      {partner.note ? <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">{partner.note}</p> : null}
                      {partner.phone ? <p className="mt-1 text-xs text-[var(--mikke-muted)]">電話：{partner.phone}</p> : null}
                      {partner.address ? <p className="mt-1 text-xs text-[var(--mikke-muted)]">住所：{partner.address}</p> : null}
                      {partner.skills ? <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]"><span className="font-bold">スキル：</span>{partner.skills}</p> : null}
                      {partner.bio ? <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]"><span className="font-bold">自己紹介：</span>{partner.bio}</p> : null}
                    </div>
                    <span className="rounded-full bg-[var(--mikke-primary-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--mikke-primary)]">
                      {partner.status === "active" ? "稼働中" : "一時停止"}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2 border-t border-[var(--mikke-line-soft)] pt-3">
                    <button
                      type="button"
                      disabled={busyPartnerId === partner.id}
                      onClick={() => void togglePause(partner)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--mikke-line)] px-2 py-1.5 text-xs font-bold text-[var(--mikke-muted)] disabled:opacity-50"
                    >
                      {partner.status === "active" ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                      {partner.status === "active" ? "一時停止" : "再開"}
                    </button>
                    <button
                      type="button"
                      disabled={busyPartnerId === partner.id}
                      onClick={() => void archive(partner)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-bold text-red-700 disabled:opacity-50"
                    >
                      <Archive size={14} /> アーカイブ
                    </button>
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

export default function TeamWorksPartnersPage() {
  return (
    <AuthGate>
      <TeamWorksPartnersContent />
    </AuthGate>
  );
}
