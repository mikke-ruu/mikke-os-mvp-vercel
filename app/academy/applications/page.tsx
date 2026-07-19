"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { listCourses } from "@/lib/academy/courses";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_ORDER,
  listApplications,
  updateApplication
} from "@/lib/academy/applications";
import { formatDate } from "@/lib/format";
import type { AcademyApplication, AcademyCourse, AcademyHeadquarters } from "@/types/database";

function StatusChip({ status }: { status: AcademyApplication["status"] }) {
  const tone =
    status === "cancelled"
      ? "border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]"
      : status === "closed" || status === "certified" || status === "instructor_added"
        ? "border-[var(--mikke-success)]/30 bg-[var(--mikke-success-soft)] text-[var(--mikke-success)]"
        : "border-[var(--mikke-accent)]/30 bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${tone}`}>
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
}

function ApplicationsContent() {
  const { profile } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [apps, setApps] = useState<AcademyApplication[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, AcademyCourse>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const foundHq = await getOwnedHeadquarters(profile.user_id);
    setHq(foundHq);
    if (foundHq) {
      const [applications, courses] = await Promise.all([
        listApplications(foundHq.id),
        listCourses(foundHq.id)
      ]);
      setApps(applications);
      setCourseMap(Object.fromEntries(courses.map((c) => [c.id, c])));
    }
    setLoading(false);
  }, [profile.user_id]);

  useEffect(() => {
    load();
  }, [load]);

  // AC-D5: 一覧の各行からステータスをその場で変更できるようにする
  async function updateStatus(app: AcademyApplication, status: AcademyApplication["status"]) {
    if (!hq) return;
    setBusyId(app.id);
    setStatusError(null);
    try {
      const next = await updateApplication(profile, hq.id, app, { status });
      setApps((prev) => prev.map((a) => (a.id === next.id ? next : a)));
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "ステータスの更新に失敗しました。");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">先に本部を作成してください。</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--mikke-muted)]">{hq.name}</p>
          <h2 className="text-base font-bold text-[var(--mikke-text)]">申込管理</h2>
        </div>
        <Link href="/academy/applications/new" className="flex items-center gap-1 rounded-full bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white">
          <Plus size={16} /> 申込を追加
        </Link>
      </div>

      {statusError ? <p className="text-sm font-bold text-[var(--mikke-danger)]">{statusError}</p> : null}

      {apps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white p-8 text-center">
          <ClipboardList size={28} className="mx-auto text-[var(--mikke-accent)]" />
          <p className="mt-2 text-sm text-[var(--mikke-text-soft)]">まだ申込がありません。</p>
          <Link href="/academy/applications/new" className="mt-3 inline-block text-xs font-bold text-[var(--mikke-accent-strong)]">
            申込を手入力で追加
          </Link>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => {
            const course = courseMap[app.course_id];
            return (
              <li key={app.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3">
                <Link href={`/academy/applications/${app.id}`} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--mikke-text)]">{app.applicant_name}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--mikke-muted)]">
                        {course ? `${course.code} ` : ""}
                        {app.intake_source === "koushi" ? "講師受付" : "本部受付"}
                        {app.event_date ? ` ・ ${formatDate(app.event_date)}` : ""}
                      </p>
                    </div>
                    <StatusChip status={app.status} />
                  </div>
                </Link>
                <select
                  className="mt-2 w-full rounded-lg border border-[var(--mikke-line)] bg-white px-2 py-1.5 text-xs font-bold text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)] disabled:opacity-60"
                  value={app.status}
                  disabled={busyId === app.id}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateStatus(app, e.target.value as AcademyApplication["status"])}
                >
                  {APPLICATION_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {APPLICATION_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function ApplicationsPage() {
  return (
    <HonbuShell title="申込管理">
      <ApplicationsContent />
    </HonbuShell>
  );
}
