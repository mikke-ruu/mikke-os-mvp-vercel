"use client";

import { BookOpen, CalendarDays, CircleUserRound, Clock, ExternalLink, FolderKanban, Users, UsersRound } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { MikkeAppShell, type MikkeShellNavItem } from "@/components/mikkeos/MikkeAppShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { useTeamWorksPortalRoles } from "@/components/team-works/useTeamWorksPortalRoles";
import { TeamWorksWorkerModeNav } from "@/components/team-works/worker-projects/TeamWorksWorkerModeNav";
import { supabase } from "@/lib/supabase/client";
import {
  loadOperationsPartnerPortal,
  respondToOperationsPartnerOffer,
  submitOperationsPartnerReport,
  type OperationsPartnerPortalData,
  type OperationsPartnerSession
} from "@/lib/team-works-operations-partner";

export function TeamWorksOperationsPartnerPortal() {
  const [data, setData] = useState<OperationsPartnerPortalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await loadOperationsPartnerPortal(supabase));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "担当スケジュールを読み込めませんでした。");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // このシェルはパートナーポータル配下でのみ使われるため、パートナー項目は判定を待たず常に出す
  // （役割判定が終わるまでサイドバー自体が一瞬消えるのを防ぐ）。
  const { hasClient } = useTeamWorksPortalRoles();
  const navItems: MikkeShellNavItem[] = [
    { label: "パートナーポータル", href: "/apps/team-works/portal/worker", icon: Users },
    ...(hasClient ? [{ label: "クライアントポータル", href: "/apps/team-works/portal/client", icon: FolderKanban }] : [])
  ];

  return (
    <MikkeAppShell
      appName="Team Works"
      title="パートナーポータル"
      subtitle="今日の担当、名簿、マニュアルをひとつの画面で確認"
      currentApp={{ label: "Team", href: "/apps/team-works/portal/worker", icon: CalendarDays }}
      theme="green"
      footerLabel="Team Works by mikke"
      navItems={navItems}
    >
      <div className="mb-6 flex flex-col gap-3 border-b border-[var(--mikke-line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <TeamWorksWorkerModeNav />
        <p className="inline-flex items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]">
          <CircleUserRound size={16} />
          {data?.memberName ? `${data.memberName}として表示` : "ログイン中の担当範囲を表示"}
        </p>
      </div>

      {!data && !error ? <p className="text-sm font-semibold text-[var(--mikke-muted)]">読み込み中…</p> : null}
      {error ? <MikkeEmptyState title="読み込みに失敗しました" helper={error} /> : null}
      {data ? <PartnerPortalBody data={data} /> : null}
    </MikkeAppShell>
  );
}

function PartnerPortalBody({ data }: { data: OperationsPartnerPortalData }) {
  const [responding, setResponding] = useState<string | null>(null);
  const [responseError, setResponseError] = useState<string | null>(null);

  async function respond(projectId: string, organizationMemberId: string, accept: boolean) {
    setResponding(projectId);
    setResponseError(null);
    try {
      await respondToOperationsPartnerOffer(supabase, { projectId, organizationMemberId, accept });
      window.location.reload();
    } catch (error) {
      setResponseError(error instanceof Error ? error.message : "参加依頼を更新できませんでした。");
    } finally {
      setResponding(null);
    }
  }

  if (data.projectCount === 0) {
    return (
      <div className="space-y-5">
        <PartnerOfferCards offers={data.offers} responding={responding} onRespond={respond} />
        {responseError ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{responseError}</p> : null}
        <MikkeEmptyState title="担当中の運営型プロジェクトはありません" helper="本部から参加依頼が届くと、ここで参加するか選べます。" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PartnerOfferCards offers={data.offers} responding={responding} onRespond={respond} />
      {responseError ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{responseError}</p> : null}
      <MikkeSection title="Today" tone="editorial">
        <p className="mb-3 -mt-2 text-xs font-semibold text-[var(--mikke-muted)]">本日の担当コマ</p>
        {data.today.length === 0 ? (
          <MikkeEmptyState
            title="本日の担当はありません"
            helper={`${data.projectCount}件の運営型プロジェクトに参加しています。`}
          />
        ) : (
          <div className="space-y-4">
            {data.today.map((session) => <SessionCard key={session.id} session={session} today onSubmitted={() => window.location.reload()} />)}
          </div>
        )}
      </MikkeSection>

      <MikkeSection title="Upcoming" tone="editorial">
        <p className="mb-3 -mt-2 text-xs font-semibold text-[var(--mikke-muted)]">30日以内の担当予定</p>
        {data.upcoming.length === 0 ? (
          <MikkeEmptyState title="今後30日間の担当予定はありません" />
        ) : (
          <div className="space-y-4">
            {data.upcoming.map((session) => <SessionCard key={session.id} session={session} onSubmitted={() => window.location.reload()} />)}
          </div>
        )}
      </MikkeSection>
    </div>
  );
}

function PartnerOfferCards({ offers, responding, onRespond }: { offers: OperationsPartnerPortalData["offers"]; responding: string | null; onRespond: (projectId: string, organizationMemberId: string, accept: boolean) => void }) {
  if (offers.length === 0) return null;
  return <MikkeSection title="参加依頼" tone="editorial"><p className="mb-3 -mt-2 text-xs font-semibold text-[var(--mikke-muted)]">本部から新しいプロジェクトへの参加依頼が届いています。</p><div className="space-y-3">{offers.map((offer) => <article key={offer.projectId} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4"><p className="text-base font-extrabold">{offer.projectTitle}</p><p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">参加後に担当レッスン、名簿、マニュアル、メッセージを確認できます。</p><div className="mt-4 flex gap-2"><button type="button" disabled={responding === offer.projectId} onClick={() => onRespond(offer.projectId, offer.organizationMemberId, true)} className="rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">参加する</button><button type="button" disabled={responding === offer.projectId} onClick={() => onRespond(offer.projectId, offer.organizationMemberId, false)} className="rounded-xl border border-[var(--mikke-line)] px-4 py-2.5 text-xs font-bold text-[var(--mikke-muted)] disabled:opacity-50">辞退する</button></div></article>)}</div></MikkeSection>;
}

function SessionCard({
  session,
  today = false,
  onSubmitted
}: {
  session: OperationsPartnerSession;
  today?: boolean;
  onSubmitted: () => void;
}) {
  const perPersonMinutes =
    session.roster.length > 0 ? Math.floor(session.durationMin / session.roster.length) : null;
  const [attendance, setAttendance] = useState<Record<string, string>>(
    Object.fromEntries(session.roster.map((item) => [item.id, item.attendanceStatus]))
  );
  const [progress, setProgress] = useState<Record<string, number>>(
    Object.fromEntries(session.roster.map((item) => [item.participantId, item.currentManualNo]))
  );
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSubmitError(null);
    try {
      await submitOperationsPartnerReport(supabase, {
        projectId: session.projectId,
        sessionId: session.id,
        attendance: session.roster.map((item) => ({
          rosterId: item.id,
          participantId: item.participantId,
          status: attendance[item.id] ?? item.attendanceStatus
        })),
        progress: session.roster.map((item) => ({
          participantId: item.participantId,
          manualNo: progress[item.participantId] ?? item.currentManualNo
        })),
        body
      });
      onSubmitted();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "報告を提出できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-white">
      <header className="flex flex-col gap-2 border-b border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--mikke-primary)]">
            {today ? "TODAY" : formatDate(session.sessionDate)}
          </p>
          <h3 className="mt-0.5 text-base font-extrabold">{session.projectTitle}</h3>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold text-[var(--mikke-muted)]">
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5">
            <Clock size={13} /> {session.startTime}・{session.durationMin}分
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5">
            <UsersRound size={13} /> {session.roster.length}名
          </span>
          {perPersonMinutes ? <span className="rounded-full bg-white px-3 py-1.5">1名 約{perPersonMinutes}分</span> : null}
        </div>
      </header>

      {session.roster.length === 0 ? (
        <div className="p-4">
          <MikkeEmptyState title="名簿はまだ設定されていません" helper="本部が対象者を設定すると、順番とマニュアルが表示されます。" />
        </div>
      ) : (
        <ol className="divide-y divide-[var(--mikke-line)]">
          {session.roster.map((item) => (
            <li key={item.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(180px,0.75fr)_minmax(0,1.8fr)]">
              <div>
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--mikke-primary)] text-sm font-extrabold text-white">
                    {item.orderIndex}
                  </span>
                  <div className="min-w-0">
                    <p className="font-extrabold">{item.participantName}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">
                      {item.level ?? "レベル未設定"}・進捗 No.{item.currentManualNo}
                    </p>
                  </div>
                </div>
                {item.cautions ? (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
                    注意：{item.cautions}
                  </p>
                ) : null}
                {!session.reportSubmitted ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="text-[11px] font-bold text-[var(--mikke-muted)]">
                      出欠
                      <select
                        value={attendance[item.id] ?? item.attendanceStatus}
                        onChange={(event) => setAttendance((current) => ({ ...current, [item.id]: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-2 py-2 text-xs text-[var(--mikke-text)]"
                      >
                        <option value="scheduled">未確認</option>
                        <option value="present">出席</option>
                        <option value="absent">欠席</option>
                        <option value="late">遅刻</option>
                        <option value="excused">連絡あり</option>
                      </select>
                    </label>
                    <label className="text-[11px] font-bold text-[var(--mikke-muted)]">
                      終了後の進捗No.
                      <input
                        type="number"
                        min={1}
                        value={progress[item.participantId] ?? item.currentManualNo}
                        onChange={(event) => setProgress((current) => ({
                          ...current,
                          [item.participantId]: Number(event.target.value)
                        }))}
                        className="mt-1 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-2 py-2 text-xs text-[var(--mikke-text)]"
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-[var(--mikke-line)] p-3">
                <p className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--mikke-primary)]">
                  <BookOpen size={14} /> 対象マニュアル
                </p>
                {item.manual ? (
                  <>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p className="font-extrabold">No.{item.manual.no} {item.manual.title}</p>
                      {item.manual.materialUrl ? (
                        <a
                          href={item.manual.materialUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--mikke-line)] px-2.5 py-1 text-xs font-bold text-[var(--mikke-primary)]"
                        >
                          教材を開く <ExternalLink size={11} />
                        </a>
                      ) : null}
                    </div>
                    <ManualList label="質問" values={item.manual.questions} />
                    <ManualList label="表現" values={item.manual.expressions} />
                    {item.manual.cautions ? (
                      <p className="mt-2 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
                        指導上の注意：{item.manual.cautions}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted)]">
                    No.{item.currentManualNo} のマニュアルはまだ登録されていません。
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <footer className="border-t border-[var(--mikke-line)] px-4 py-3">
        {session.reportSubmitted ? (
          <p className="text-xs font-bold text-[var(--mikke-primary)]">このコマの報告は提出済みです。本部の確認後に正本へ反映されます。</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-xs font-bold text-[var(--mikke-muted)]">
              コマ報告
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="実施内容、引継ぎ、気になったこと"
                rows={3}
                className="mt-1.5 w-full resize-y rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)]"
              />
            </label>
            {submitError ? <p role="alert" className="text-xs font-bold text-red-700">{submitError}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-[var(--mikke-muted)]">提出内容は本部確認後に出欠・進捗へ反映されます。</p>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[var(--mikke-primary)] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {saving ? "提出中…" : "報告を提出"}
              </button>
            </div>
          </form>
        )}
      </footer>
    </article>
  );
}

function ManualList({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="mt-2 text-xs leading-5">
      <span className="font-bold">{label}：</span>
      <span className="font-semibold text-[var(--mikke-muted)]">{values.join("／")}</span>
    </div>
  );
}

function formatDate(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日（${"日月火水木金土"[date.getDay()]}）`;
}
