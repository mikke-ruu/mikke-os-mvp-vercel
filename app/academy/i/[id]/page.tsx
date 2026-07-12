"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Instagram, MapPin, Monitor } from "lucide-react";
import { getListedInstructor, getPublicCourse } from "@/lib/academy/lp";
import type { AcademyCourse, AcademyInstructor } from "@/types/database";

// 講師の営業用ページ（公開）
// 本部が作った講座情報 + 講師プロフィール。このページ経由の申込は講師受付になる。

function InstructorPublicInner({ instructorId }: { instructorId: string }) {
  const [instructor, setInstructor] = useState<AcademyInstructor | null>(null);
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const ins = await getListedInstructor(instructorId).catch(() => null);
      setInstructor(ins);
      if (ins) setCourse(await getPublicCourse(ins.course_id).catch(() => null));
      setLoading(false);
    }
    load();
  }, [instructorId]);

  if (loading) return <p className="py-24 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!instructor || !instructor.is_listed) {
    return <p className="py-24 text-center text-sm text-[var(--mikke-muted)]">このページは公開されていません。</p>;
  }

  const canApply = course?.is_published && instructor.accepts_applications && instructor.is_active;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 md:py-16">
      {/* 講師プロフィール */}
      <section className="rounded-[2rem] border border-[var(--mikke-line)] bg-white p-6 text-center md:p-10">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--mikke-accent-soft)] text-2xl font-bold text-[var(--mikke-accent)]">
          {(instructor.business_name || "講")[0]}
        </span>
        <h1 className="mt-4 text-xl font-bold tracking-wide text-[var(--mikke-text)] md:text-2xl">
          {instructor.business_name || "認定講師"}
        </h1>
        {course ? (
          <p className="mt-1 text-xs font-bold tracking-[0.2em] text-[var(--mikke-accent-strong)]">
            {course.code} 認定講師
            {instructor.instructor_number ? ` ・ No.${instructor.instructor_number}` : ""}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-[var(--mikke-muted)]">
          {instructor.area ? (
            <span className="flex items-center gap-1">
              <MapPin size={13} /> {instructor.area}
            </span>
          ) : null}
          {instructor.online_available ? (
            <span className="flex items-center gap-1">
              <Monitor size={13} /> オンライン対応
            </span>
          ) : null}
          {instructor.instagram_url ? (
            <a href={instructor.instagram_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-bold text-[var(--mikke-accent)]">
              <Instagram size={13} /> Instagram
            </a>
          ) : null}
        </div>
        {instructor.self_intro ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-text)]">{instructor.self_intro}</p>
        ) : null}
        {instructor.message ? (
          <div className="mt-4 rounded-2xl bg-[var(--mikke-surface-soft)] p-4 text-left">
            <p className="text-[10px] font-bold tracking-widest text-[var(--mikke-accent-strong)]">MESSAGE</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-text)]">{instructor.message}</p>
          </div>
        ) : null}
        {instructor.available_note ? (
          <p className="mt-3 text-xs leading-6 text-[var(--mikke-muted)]">{instructor.available_note}</p>
        ) : null}
      </section>

      {/* 開催できる講座 */}
      {course && course.is_published ? (
        <section className="mt-6 overflow-hidden rounded-[2rem] border border-[var(--mikke-line)] bg-white">
          {course.main_image_url ? <img src={course.main_image_url} alt="" className="h-48 w-full object-cover md:h-64" /> : null}
          <div className="p-6 text-center md:p-8">
            <p className="text-[10px] font-bold tracking-[0.25em] text-[var(--mikke-accent-strong)]">{course.code}</p>
            <h2 className="mt-1 text-lg font-bold text-[var(--mikke-text)] md:text-xl">{course.name}</h2>
            {course.subtitle ? <p className="mt-1 text-xs text-[var(--mikke-muted)]">{course.subtitle}</p> : null}
            <p className="mt-3 text-sm font-bold text-[var(--mikke-text)]">
              受講料 {course.price.toLocaleString()}円
              {course.duration_text ? <span className="ml-2 text-xs font-normal text-[var(--mikke-muted)]">{course.duration_text}</span> : null}
            </p>
            <div className="mt-5 space-y-2">
              {canApply ? (
                <Link
                  href={`/academy/apply/${course.id}?k=${instructor.id}`}
                  className="mx-auto block w-full max-w-xs rounded-full bg-[var(--mikke-accent)] py-3 text-center text-sm font-bold text-white transition hover:opacity-90"
                >
                  この講師に申し込む
                </Link>
              ) : (
                <p className="text-xs text-[var(--mikke-muted)]">現在、この講師の申込受付は停止中です。</p>
              )}
              <Link
                href={`/academy/c/${course.id}?k=${instructor.id}`}
                className="mx-auto flex w-fit items-center gap-1 text-xs font-bold text-[var(--mikke-accent-strong)]"
              >
                講座の詳細を見る <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <p className="mt-8 text-center text-[10px] tracking-widest text-[var(--mikke-muted-light)]">POWERED BY Academy</p>
    </div>
  );
}

export default function InstructorPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <main className="min-h-screen bg-[var(--mikke-surface-soft)]">
      <InstructorPublicInner instructorId={id} />
    </main>
  );
}
