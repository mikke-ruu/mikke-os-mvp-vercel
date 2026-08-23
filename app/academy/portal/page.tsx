"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList, GraduationCap, Link2, Package } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { KoushiShell } from "@/components/academy/AcademyShell";
import { INSTRUCTOR_STATUS_LABELS } from "@/lib/academy/instructors";
import { getCoursesByIds, getMyInstructorRecords, listMyApplications } from "@/lib/academy/instructor-portal";
import { listMyKitOrders } from "@/lib/academy/kits";
import { APPLICATION_STATUS_LABELS } from "@/lib/academy/applications";
import type { AcademyApplication, AcademyCourse, AcademyInstructor, AcademyKitOrder } from "@/types/database";

function QuickCard({
  href,
  icon: Icon,
  title,
  desc
}: {
  href: string;
  icon: typeof GraduationCap;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 transition hover:border-[var(--mikke-accent)]/40">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[var(--mikke-text)]">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-[var(--mikke-muted)]">{desc}</span>
      </span>
      <ArrowRight size={15} className="shrink-0 text-[var(--mikke-accent)]" />
    </Link>
  );
}

function PortalDashboard() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<AcademyInstructor[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, AcademyCourse>>({});
  const [apps, setApps] = useState<AcademyApplication[]>([]);
  const [kits, setKits] = useState<AcademyKitOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const myRecords = await getMyInstructorRecords(profile.user_id);
      setRecords(myRecords);
      const [courses, myApps, myKits] = await Promise.all([
        getCoursesByIds(myRecords.map((r) => r.course_id)),
        listMyApplications(myRecords.map((r) => r.id)),
        listMyKitOrders(myRecords.map((r) => r.id))
      ]);
      setCourseMap(Object.fromEntries(courses.map((c) => [c.id, c])));
      setApps(myApps);
      setKits(myKits);
      setLoading(false);
    }
    load();
  }, [profile.user_id]);

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;

  if (records.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-center">
        <p className="text-sm font-bold text-[var(--mikke-text)]">まだ講師登録されていません</p>
        <p className="mt-1 text-xs text-[var(--mikke-muted)]">本部が認定講師として登録すると、ここに表示されます。</p>
      </div>
    );
  }

  const pendingApps = apps.filter((a) => a.status === "received");
  const recentApps = apps.slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--mikke-accent)]/35 bg-[var(--mikke-accent-soft)] p-4">
        <p className="text-sm font-bold text-[var(--mikke-accent-strong)]">{profile.display_name}さんのマイポータル</p>
        <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">受講中・修了した講座と教材はここで確認します。認定講師になった講座には、営業・申込・開催・キット発注の機能が追加されます。</p>
      </section>

      <h2 className="text-sm font-bold text-[var(--mikke-text)]">取得した認定・営業できる講座</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {records.map((rec) => {
          const course = courseMap[rec.course_id];
          const activityLabel = rec.is_active ? INSTRUCTOR_STATUS_LABELS[rec.status] : "活動なし";
          return (
            <div key={rec.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[var(--mikke-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">{course?.code}</span>
                <p className="truncate text-sm font-bold text-[var(--mikke-text)]">{course?.name}</p>
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--mikke-muted)]">
                {rec.is_certified ? "認定済み" : "未認定"} ・ {activityLabel}
                {rec.instructor_number ? ` ・ No.${rec.instructor_number}` : ""}
              </p>
            </div>
          );
        })}
      </div>

      {/* クイックメニュー */}
      <div className="grid gap-3 md:grid-cols-2">
        <QuickCard href="/academy/portal/study" icon={GraduationCap} title="教材・復習" desc="講座の資料・動画・リンク集をいつでも確認" />
        <QuickCard href="/academy/portal/url" icon={Link2} title="営業用URL" desc="あなた専用の講師紹介ページをSNSで活用" />
        <QuickCard href="/academy/portal/applications" icon={ClipboardList} title="申込管理" desc={`担当申込 ${apps.length}件${pendingApps.length ? `（未対応 ${pendingApps.length}件）` : ""}`} />
        <QuickCard href="/academy/portal/kits" icon={Package} title="キット発注" desc={`注文履歴 ${kits.length}件`} />
      </div>

      {/* 最近の担当申込 */}
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--mikke-text)]">最近の担当申込</h2>
          <Link href="/academy/portal/applications" className="flex items-center gap-1 text-xs font-bold text-[var(--mikke-accent)]">
            一覧を見る <ArrowRight size={13} />
          </Link>
        </div>
        {recentApps.length === 0 ? (
          <p className="mt-4 text-xs text-[var(--mikke-muted)]">まだ担当申込がありません。営業用URLから申込が入るとここに表示されます。</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--mikke-surface-soft)]">
            {recentApps.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--mikke-text)]">{a.applicant_name}</p>
                  <p className="text-[11px] text-[var(--mikke-muted)]">{courseMap[a.course_id]?.code ?? ""}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--mikke-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">
                  {APPLICATION_STATUS_LABELS[a.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function PortalPage() {
  return (
    <KoushiShell title="マイポータル">
      <PortalDashboard />
    </KoushiShell>
  );
}
