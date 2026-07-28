"use client";

import { Clock, MessageSquare, Plus, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeSection } from "@/components/mikkeos/MikkeSection";
import { supabase } from "@/lib/supabase/client";
import { createOperationsProject } from "@/lib/team-works-operations-project";
import {
  formatDateKey,
  loadOperationsDashboardData,
  type OperationsDashboardData
} from "@/lib/team-works-operations";
import { TeamWorksDayPanel } from "./TeamWorksDayPanel";
import { TeamWorksMonthCalendar } from "./TeamWorksMonthCalendar";
import { TeamWorksShiftAdminPanel } from "./TeamWorksShiftAdminPanel";
import { loadStaffPartnerShifts, type PartnerShiftSubmission } from "@/lib/team-works-shifts";

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function TeamWorksOperationsDashboard() {
  const [monthDate, setMonthDate] = useState<Date>(startOfCurrentMonth);
  const [data, setData] = useState<OperationsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [shiftSubmissions, setShiftSubmissions] = useState<PartnerShiftSubmission[]>([]);
  const [calendarAutoPositioned, setCalendarAutoPositioned] = useState(false);

  const load = useCallback(async (targetMonth: Date) => {
    setLoading(true);
    setError(null);
    try {
      const [result, shifts] = await Promise.all([
        loadOperationsDashboardData(supabase, targetMonth),
        loadStaffPartnerShifts(supabase, targetMonth)
      ]);
      setData(result);
      setShiftSubmissions(shifts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "ダッシュボードの読み込みに失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(monthDate);
  }, [monthDate, load]);

  useEffect(() => {
    const timerId = window.setInterval(() => void load(monthDate), 5000);
    return () => window.clearInterval(timerId);
  }, [load, monthDate]);

  useEffect(() => {
    if (calendarAutoPositioned || !data) return;
    const todayKey = formatDateKey(new Date());
    const hasFutureEventInVisibleMonth = data.monthEvents.some((event) => event.sessionDate >= todayKey);
    const nextEvent = data.upcomingEvents[0];
    setCalendarAutoPositioned(true);
    if (!hasFutureEventInVisibleMonth && nextEvent) {
      const nextEventDate = new Date(`${nextEvent.sessionDate}T00:00:00`);
      if (
        nextEventDate.getFullYear() !== monthDate.getFullYear()
        || nextEventDate.getMonth() !== monthDate.getMonth()
      ) {
        setMonthDate(new Date(nextEventDate.getFullYear(), nextEventDate.getMonth(), 1));
      }
    }
  }, [calendarAutoPositioned, data, monthDate]);

  if (loading && !data) {
    return <p className="text-sm text-[var(--mikke-muted)]">読み込んでいます…</p>;
  }

  if (error) {
    return <MikkeEmptyState title="読み込みに失敗しました" helper={error} />;
  }

  if (!data || !data.hasOperationsProjects) {
    return <FirstOperationsProjectSetup />;
  }

  const selectedDayEvents = selectedDayKey ? data.monthEvents.filter((event) => event.sessionDate === selectedDayKey) : [];
  const selectedDayHolidays = selectedDayKey ? data.monthHolidays.filter((holiday) => holiday.date === selectedDayKey) : [];
  const todayKey = formatDateKey(new Date());
  const shiftAvailability = [...shiftSubmissions.reduce((map, submission) => {
    for (const date of submission.availableDates) {
      map.set(date, [...(map.get(date) ?? []), submission.partnerName]);
    }
    return map;
  }, new Map<string, string[]>())].map(([date, names]) => ({ date, names }));

  return (
    <div className="space-y-6">
      {data.activePresenceEvents.length > 0 ? (
        <section aria-live="polite" className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Clock size={18} className="text-emerald-700" />
            <h2 className="text-sm font-extrabold text-emerald-950">只今のレッスン状況</h2>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
              {data.activePresenceEvents.length}件
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {data.activePresenceEvents.map((event) => (
              <Link
                key={event.id}
                href={`/apps/team-works/projects/${event.projectId}?tab=schedule`}
                className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-3 py-3"
              >
                <PartnerPresenceLabel status={event.partnerPresenceStatus} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold">{event.projectTitle}</span>
                  <span className="block text-[11px] font-semibold text-[var(--mikke-muted)]">
                    {event.sessionDate} {event.startTime} · 担当 {event.partnerName ?? "未定"}
                  </span>
                </span>
                <span className="text-xs font-bold text-[var(--mikke-primary)]">確認</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.7fr_1fr]">
        <TeamWorksMonthCalendar
          monthDate={monthDate}
          onMonthChange={(nextMonth) => {
            setCalendarAutoPositioned(true);
            setSelectedDayKey(null);
            setMonthDate(nextMonth);
          }}
          events={data.monthEvents}
          holidayDates={data.monthHolidayDates}
          projects={data.projects}
          shiftAvailability={shiftAvailability}
          onSelectDay={setSelectedDayKey}
        />

        <div className="flex flex-col gap-4">
          <FinanceCard />
          <MessagesCard comments={data.recentComments} />
        </div>
      </div>

      <TeamWorksShiftAdminPanel
        targetMonth={monthDate}
        submissions={shiftSubmissions}
        onRefresh={() => load(monthDate)}
      />

      <MikkeSection title="Today" tone="editorial">
        <p className="mb-2 -mt-2 text-xs font-semibold text-[var(--mikke-muted)]">本日のスケジュール（本部）</p>
        {data.todayEvents.length === 0 ? (
          <MikkeEmptyState title="本日の予定はありません" />
        ) : (
          <div className="divide-y divide-[var(--mikke-line)] rounded-xl border border-[var(--mikke-line)] bg-white">
            {data.todayEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-3 px-3 py-3">
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: event.bg }} />
                <span className="w-12 shrink-0 text-sm font-bold">{event.startTime}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {event.projectTitle}
                    {event.participantCount > 0 ? ` · 参加${event.participantCount}名` : ""}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-[var(--mikke-muted)]">
                    {event.partnerName ? <span>担当 {event.partnerName}</span> : <span className="text-[var(--mikke-accent)]">担当未定</span>}
                    <PartnerPresenceLabel status={event.partnerPresenceStatus} />
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} /> {event.durationMin}分
                    </span>
                    {event.zoomMeetingId ? <span>Zoom ID {event.zoomMeetingId}</span> : null}
                  </span>
                </span>
                <Link
                  href={`/apps/team-works/projects/${event.projectId}?tab=schedule`}
                  className="shrink-0 rounded-full border border-[var(--mikke-line)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-primary)]"
                >
                  スケジュール
                </Link>
              </div>
            ))}
          </div>
        )}
      </MikkeSection>

      <MikkeSection title="Needs attention" tone="editorial">
        <p className="mb-2 -mt-2 text-xs font-semibold text-[var(--mikke-muted)]">緊急・期日が近い・大事なこと</p>
        {data.needsAttentionUnassigned.length === 0 ? (
          <MikkeEmptyState title="対応が必要なことはありません" helper="今後7日間、担当未定のコマはありません。" />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.needsAttentionUnassigned.map((event) => (
              <Link
                key={event.id}
                href={`/apps/team-works/projects/${event.projectId}?tab=schedule`}
                className="rounded-xl border border-l-4 border-[var(--mikke-line)] p-3 text-left"
                style={{ borderLeftColor: "var(--mikke-orange)" }}
              >
                <span className="float-right text-lg font-extrabold text-[var(--mikke-orange)]">!</span>
                <span className="block text-sm font-bold text-[var(--mikke-orange)]">シフト未決定</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--mikke-muted)]">
                  {formatShortDate(event.sessionDate, todayKey)} {event.startTime} {event.projectTitle}、担当未定。
                </span>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-4 border-t border-[var(--mikke-line)] pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-extrabold text-[var(--mikke-primary)]">今後のスケジュール（3件）</p>
            <Link href="/apps/team-works/schedule" className="text-xs font-bold text-[var(--mikke-primary)]">すべて見る</Link>
          </div>
          {data.upcomingEvents.length === 0 ? (
            <p className="text-xs font-semibold text-[var(--mikke-muted)]">今後の予定はありません。</p>
          ) : (
            <div className="grid gap-2">
              {data.upcomingEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/apps/team-works/projects/${event.projectId}?tab=schedule`}
                  className="grid gap-2 rounded-xl border border-[var(--mikke-line)] bg-white p-3 transition hover:border-[#8bc7ad] sm:grid-cols-[90px_1fr_auto] sm:items-center"
                >
                  <span className="rounded-lg bg-[#ffd370] px-2 py-2 text-center text-xs font-extrabold text-[#1b1b1f]">
                    {formatShortDate(event.sessionDate, todayKey)} {event.startTime}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{event.projectTitle}</span>
                    <span className="block text-[11px] font-semibold text-[var(--mikke-muted)]">
                      {event.partnerName ? `担当 ${event.partnerName}` : "担当未定"}
                      {event.zoomMeetingId ? ` · Zoom ID ${event.zoomMeetingId}` : ""}
                    </span>
                  </span>
                  <PartnerPresenceLabel status={event.partnerPresenceStatus} />
                  <span className="text-xs font-bold text-[var(--mikke-primary)]">開く</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </MikkeSection>

      {selectedDayKey ? (
        <TeamWorksDayPanel
          dateKey={selectedDayKey}
          events={selectedDayEvents}
          holidays={selectedDayHolidays}
          onClose={() => setSelectedDayKey(null)}
        />
      ) : null}
    </div>
  );
}

function PartnerPresenceLabel({ status }: { status: "not_started" | "standby" | "in_progress" | "ended" }) {
  if (status === "not_started") return null;
  const labels = { standby: "スタンバイ", in_progress: "実施中", ended: "終了" };
  const tone = status === "standby" ? "bg-amber-100 text-amber-800" : status === "in_progress" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold ${tone}`}>{labels[status]}</span>;
}

function FirstOperationsProjectSetup() {
  const router = useRouter();
  const [title, setTitle] = useState("スリランカ校");
  const [organizationName, setOrganizationName] = useState("アリサ日本語レッスン");
  const [contractStartedOn, setContractStartedOn] = useState(formatDateKey(new Date()));
  const [contractEndedOn, setContractEndedOn] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const projectId = await createOperationsProject(supabase, {
        organizationName,
        title,
        contractStartedOn,
        contractEndedOn
      });
      router.push(`/apps/team-works/projects/${projectId}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "運営型プロジェクトの作成に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--mikke-green)] text-[#1b1b1f]">
            <Plus size={21} />
          </span>
          <div>
            <h2 className="text-base font-extrabold">最初の運営型プロジェクトを作成</h2>
            <p className="mt-1 text-xs leading-5 font-semibold text-[var(--mikke-muted)]">
              学校・店舗・継続契約など、期間中ずっと運営する仕事を1プロジェクトとして作ります。作成後、名簿・マニュアル・スケジュール画面へ移動します。
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-bold">プロジェクト名 <span className="text-[var(--mikke-accent)]">*</span></span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例：スリランカ校"
              required
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold">組織名</span>
            <input
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              placeholder="例：アリサ日本語レッスン"
              className={inputClass}
            />
            <span className="mt-1 block text-[11px] leading-5 font-semibold text-[var(--mikke-muted)]">
              すでに所属組織がある場合は既存組織を使い、この入力は初回セットアップ時だけ使用します。
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold">契約開始日</span>
              <input
                type="date"
                value={contractStartedOn}
                onChange={(event) => setContractStartedOn(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold">契約終了日</span>
              <input
                type="date"
                value={contractEndedOn}
                min={contractStartedOn || undefined}
                onChange={(event) => setContractEndedOn(event.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          {error ? (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--mikke-primary)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            <Plus size={16} /> {saving ? "作成中…" : "運営型プロジェクトを作成"}
          </button>
        </form>
      </div>
    </div>
  );
}

function formatShortDate(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "本日";
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function FinanceCard() {
  return (
    <Link href="/apps/team-works/projects" className="block rounded-2xl border border-[#ffd370] bg-white p-4 transition hover:border-[#8bc7ad]">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--mikke-primary)]">
          <Wallet size={13} /> Finance
        </span>
        <span className="text-[11px] font-bold text-[var(--mikke-muted-light)]">今月・本部のみ</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-[6px] border-[var(--mikke-line-soft)]">
          <span className="text-xs font-bold text-[var(--mikke-muted-light)]">未設定</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {[
            { label: "売上想定", color: "var(--mikke-blue)" },
            { label: "経費想定", color: "var(--mikke-orange)" },
            { label: "利益見込み", color: "var(--mikke-green)" }
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-lg bg-[var(--mikke-surface-soft)] px-2.5 py-1.5 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--mikke-muted)]">
                <span className="h-2 w-2 rounded-[3px]" style={{ background: row.color }} />
                {row.label}
              </span>
              <span className="font-bold text-[var(--mikke-muted-light)]">—</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[10.5px] leading-5 text-[var(--mikke-muted-light)]">
        パートナー報酬・請求のレートがまだ設定されていないため集計できません。レート項目を追加すると自動で表示されます。
      </p>
    </Link>
  );
}

function MessagesCard({ comments }: { comments: OperationsDashboardData["recentComments"] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#f9d3d2] bg-white">
      <div className="flex items-baseline justify-between px-4 pt-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--mikke-primary)]">
          <MessageSquare size={13} /> Messages
        </span>
      </div>
      <div className="mt-3">
        {comments.length === 0 ? (
          <p className="px-4 pb-4 text-xs font-semibold text-[var(--mikke-muted)]">新着メッセージはありません。</p>
        ) : (
          <div className="divide-y divide-[var(--mikke-line)]">
            {comments.map((comment) => (
              <Link key={comment.id} href={`/apps/team-works/projects/${comment.projectId}?tab=messages`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--mikke-surface-soft)]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f9d3d2] text-[#3f4eb5]">
                  <Users size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold">
                    {comment.authorName}（{comment.projectTitle}）
                  </span>
                  <span className="block truncate text-[11px] font-semibold text-[var(--mikke-muted)]">{comment.body}</span>
                </span>
                <span className="shrink-0 text-[10px] font-semibold text-[var(--mikke-muted-light)]">{formatRelativeTime(comment.createdAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return "たった今";
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}時間前`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}日前`;
}
