"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PenSquare } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { listCourses } from "@/lib/academy/courses";
import type { AcademyCourse, AcademyHeadquarters } from "@/types/database";

function InstructorPagesContent() {
  const { profile } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const foundHq = await getOwnedHeadquarters(profile.user_id);
      setHq(foundHq);
      if (foundHq) setCourses(await listCourses(foundHq.id));
      setLoading(false);
    }
    load();
  }, [profile.user_id]);

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">先に本部を作成してください。</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <p className="text-xs text-[var(--mikke-muted)]">
        講座ごとの講師専用ページ（復習・資材仕入共有・資料）を編集します。この講座を取得した活動中の講師だけが閲覧できます。
      </p>
      <ul className="space-y-2">
        {courses.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--mikke-line)] bg-white px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--mikke-text)]">
                {c.code} {c.name}
              </p>
              <p className="text-[11px] text-[var(--mikke-muted)]">講師専用ページをビルド式で編集</p>
            </div>
            <Link
              href={`/academy/courses/${c.id}/instructor-page`}
              className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--mikke-accent-soft)] px-3 py-1.5 text-xs font-bold text-[var(--mikke-accent-strong)]"
            >
              <PenSquare size={13} /> 編集する
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function InstructorPagesPage() {
  return (
    <HonbuShell title="講師ページ編集">
      <InstructorPagesContent />
    </HonbuShell>
  );
}
