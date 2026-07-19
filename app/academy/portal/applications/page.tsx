"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Package } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { KoushiShell } from "@/components/academy/AcademyShell";
import { APPLICATION_STATUS_LABELS } from "@/lib/academy/applications";
import { getCoursesByIds, getMyInstructorRecords, listMyApplications } from "@/lib/academy/instructor-portal";
import { formatDate } from "@/lib/format";
import type { AcademyApplication, AcademyCourse, AcademyInstructor } from "@/types/database";

function MyApplicationsContent() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<AcademyInstructor[]>([]);
  const [apps, setApps] = useState<AcademyApplication[]>([]);
  const [courseMap, setCourseMap] = useState<Record<string, AcademyCourse>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const myRecords = await getMyInstructorRecords(profile.user_id);
      setRecords(myRecords);
      const [myApps, courses] = await Promise.all([
        listMyApplications(myRecords.map((r) => r.id)),
        getCoursesByIds(myRecords.map((r) => r.course_id))
      ]);
      setApps(myApps);
      setCourseMap(Object.fromEntries(courses.map((c) => [c.id, c])));
      setLoading(false);
    }
    load();
  }, [profile.user_id]);

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (records.length === 0) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">まだ講師登録されていません。</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="text-xs text-[var(--mikke-muted)]">
        あなたの営業用URLから入った申込（担当申込）の一覧です。ステータスの更新は本部が行います。
        受講に必要なキットは、ここから注文してください。
      </p>

      {apps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white p-10 text-center">
          <ClipboardList size={28} className="mx-auto text-[var(--mikke-accent)]" />
          <p className="mt-2 text-sm text-[var(--mikke-text-soft)]">まだ担当申込がありません。</p>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {apps.map((a) => (
            <li key={a.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--mikke-text)]">{a.applicant_name}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--mikke-muted)]">
                    {courseMap[a.course_id]?.code ?? ""}
                    {a.event_date ? ` ・ ${formatDate(a.event_date)}` : ""} ・ {a.price.toLocaleString()}円
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--mikke-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">
                  {APPLICATION_STATUS_LABELS[a.status]}
                </span>
              </div>
              <Link
                href={`/academy/portal/kits?application=${a.id}`}
                className="mt-2 inline-flex items-center gap-1 rounded-full border border-[var(--mikke-line)] px-2.5 py-1 text-[11px] font-bold text-[var(--mikke-accent-strong)]"
              >
                <Package size={12} /> キットを注文する
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MyApplicationsPage() {
  return (
    <KoushiShell title="申込管理">
      <MyApplicationsContent />
    </KoushiShell>
  );
}
