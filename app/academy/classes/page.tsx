"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck, Plus } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import {
  cancelClassInstructorRequest,
  CLASS_INSTRUCTOR_REQUEST_STATUS_LABELS,
  createClassInstructorRequest,
  listClassInstructorRequests
} from "@/lib/academy/class-instructor-requests";
import { listAcademyClasses } from "@/lib/academy/classes";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { listInstructors } from "@/lib/academy/instructors";
import type {
  AcademyClass,
  AcademyClassInstructorRequest,
  AcademyHeadquarters,
  AcademyInstructor
} from "@/types/database";

const fieldClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";

function formatDateTime(value: string | null) {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function ClassesContent() {
  const { profile } = useAuth();
  const [headquarters, setHeadquarters] = useState<AcademyHeadquarters | null>(null);
  const [classes, setClasses] = useState<AcademyClass[]>([]);
  const [instructors, setInstructors] = useState<AcademyInstructor[]>([]);
  const [requests, setRequests] = useState<AcademyClassInstructorRequest[]>([]);
  const [instructorByClass, setInstructorByClass] = useState<Record<string, string>>({});
  const [noteByClass, setNoteByClass] = useState<Record<string, string>>({});
  const [respondByClass, setRespondByClass] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const nextHeadquarters = await getOwnedHeadquarters(profile.user_id);
      setHeadquarters(nextHeadquarters);
      if (!nextHeadquarters) {
        setClasses([]);
        setInstructors([]);
        setRequests([]);
        return;
      }

      const [nextClasses, nextInstructors, nextRequests] = await Promise.all([
        listAcademyClasses(nextHeadquarters.id),
        listInstructors(nextHeadquarters.id),
        listClassInstructorRequests(nextHeadquarters.id)
      ]);
      setClasses(nextClasses);
      setInstructors(nextInstructors.filter((item) => item.is_active));
      setRequests(nextRequests);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "開催日程を読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, [profile.user_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const requestsByClass = useMemo(() => {
    return requests.reduce<Record<string, AcademyClassInstructorRequest[]>>((grouped, request) => {
      (grouped[request.class_id] ??= []).push(request);
      return grouped;
    }, {});
  }, [requests]);

  async function requestInstructor(classItem: AcademyClass) {
    if (!headquarters) return;
    const instructorId = instructorByClass[classItem.id];
    if (!instructorId) return;

    setBusyId(classItem.id);
    setMessage("");
    try {
      await createClassInstructorRequest({
        headquartersId: headquarters.id,
        classId: classItem.id,
        instructorId,
        requestNote: noteByClass[classItem.id] ?? "",
        respondBy: respondByClass[classItem.id]
          ? new Date(respondByClass[classItem.id]).toISOString()
          : null
      });
      setNoteByClass((current) => ({ ...current, [classItem.id]: "" }));
      setRespondByClass((current) => ({ ...current, [classItem.id]: "" }));
      setMessage("講師へ担当依頼を送りました。");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "担当依頼を送れませんでした。");
    } finally {
      setBusyId("");
    }
  }

  async function cancelRequest(requestId: string) {
    setBusyId(requestId);
    setMessage("");
    try {
      await cancelClassInstructorRequest(requestId);
      setMessage("担当依頼を取り消しました。");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "担当依頼を取り消せませんでした。");
    } finally {
      setBusyId("");
    }
  }

  if (loading) {
    return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">開催日程を確認しています…</p>;
  }

  if (!headquarters) {
    return (
      <p className="rounded-2xl border border-[var(--mikke-line)] bg-white p-6 text-sm text-[var(--mikke-muted)]">
        先に本部を作成すると、講座の開催日程と講師依頼を管理できます。
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent)]">
            <CalendarCheck size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[var(--mikke-text)]">開催日程と担当講師</h2>
            <p className="mt-1 text-sm text-[var(--mikke-muted)]">
              「講座」は教える内容、「開催日程」はその講座を実際に行う日時・場所・定員の記録です。開催日ごとに認定講師へ担当を依頼できます。
            </p>
          </div>
          <Link
            href={toCurrentAcademyContextHref("/academy/classes/new")}
            className="inline-flex items-center gap-1 rounded-xl bg-[var(--mikke-primary)] px-4 py-2 text-sm font-bold text-white"
          >
            <Plus size={16} /> 開催日程を作成
          </Link>
        </div>
        {message ? <p className="mt-4 text-sm font-bold text-[var(--mikke-accent-strong)]">{message}</p> : null}
      </section>

      {classes.length ? (
        classes.map((classItem) => {
          const classRequests = requestsByClass[classItem.id] ?? [];
          const courseInstructors = instructors.filter((item) => item.course_id === classItem.course_id);
          return (
            <section key={classItem.id} className="rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[var(--mikke-accent-strong)]">
                    {classItem.course?.code} {classItem.course?.name}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-[var(--mikke-text)]">{classItem.title}</h3>
                  <p className="mt-2 text-sm text-[var(--mikke-muted)]">
                    {classItem.schedule_mode === "arranged_after_application" && !classItem.starts_at
                      ? "申込後に日程を相談"
                      : formatDateTime(classItem.starts_at)}
                    {classItem.ends_at ? ` 〜 ${formatDateTime(classItem.ends_at)}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-[var(--mikke-muted)]">
                    {classItem.format === "online" ? "オンライン" : "対面"}
                    {classItem.venue_name ? ` ・ ${classItem.venue_name}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--mikke-surface-soft)] px-3 py-1 text-xs font-bold text-[var(--mikke-text-soft)]">
                  担当: {classItem.instructor?.business_name ?? "未決定"}
                </span>
              </div>

              {classRequests.length ? (
                <div className="mt-4 space-y-2 border-t border-[var(--mikke-line)] pt-4">
                  <p className="text-xs font-bold text-[var(--mikke-text)]">依頼履歴</p>
                  {classRequests.map((request) => (
                    <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--mikke-surface-soft)] px-3 py-2">
                      <div>
                        <p className="text-sm font-bold text-[var(--mikke-text)]">
                          {request.instructor?.business_name ?? "講師"} ・ {CLASS_INSTRUCTOR_REQUEST_STATUS_LABELS[request.status]}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--mikke-muted)]">
                          {request.request_note || "依頼メモなし"}
                          {request.respond_by ? ` ・ 回答期限 ${formatDateTime(request.respond_by)}` : ""}
                        </p>
                      </div>
                      {request.status === "requested" ? (
                        <button
                          type="button"
                          disabled={busyId === request.id}
                          onClick={() => void cancelRequest(request.id)}
                          className="rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-text-soft)] disabled:opacity-50"
                        >
                          依頼を取り消す
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 grid gap-2 border-t border-[var(--mikke-line)] pt-4 md:grid-cols-2">
                <select
                  aria-label={`${classItem.title}の担当講師`}
                  value={instructorByClass[classItem.id] ?? ""}
                  onChange={(event) =>
                    setInstructorByClass((current) => ({ ...current, [classItem.id]: event.target.value }))
                  }
                  className={fieldClass}
                >
                  <option value="">講師を選択</option>
                  {courseInstructors.map((instructor) => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.business_name || instructor.instructor_number || "認定講師"}
                    </option>
                  ))}
                </select>
                <input
                  value={noteByClass[classItem.id] ?? ""}
                  onChange={(event) =>
                    setNoteByClass((current) => ({ ...current, [classItem.id]: event.target.value }))
                  }
                  placeholder="依頼メモ（任意）"
                  className={fieldClass}
                />
                <input
                  type="datetime-local"
                  aria-label={`${classItem.title}の回答期限`}
                  value={respondByClass[classItem.id] ?? ""}
                  onChange={(event) =>
                    setRespondByClass((current) => ({ ...current, [classItem.id]: event.target.value }))
                  }
                  className={fieldClass}
                />
                <button
                  type="button"
                  disabled={busyId === classItem.id || !instructorByClass[classItem.id]}
                  onClick={() => void requestInstructor(classItem)}
                  className="rounded-xl bg-[var(--mikke-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  担当を依頼する
                </button>
              </div>
              {!courseInstructors.length ? (
                <p className="mt-2 text-xs text-[var(--mikke-muted)]">この講座には依頼できる有効な講師がいません。</p>
              ) : null}
            </section>
          );
        })
      ) : (
        <section className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white p-6 text-center">
          <p className="text-sm font-bold text-[var(--mikke-text)]">開催日程はまだありません</p>
          <p className="mt-1 text-xs text-[var(--mikke-muted)]">講座を選び、日程・形式・定員を登録すると担当講師へ依頼できます。</p>
          <Link
            href={toCurrentAcademyContextHref("/academy/classes/new")}
            className="mt-4 inline-flex items-center gap-1 rounded-xl bg-[var(--mikke-primary)] px-4 py-2 text-sm font-bold text-white"
          >
            <Plus size={16} /> 最初の開催日程を作成
          </Link>
        </section>
      )}
    </div>
  );
}

export default function AcademyClassesPage() {
  return (
    <HonbuShell title="開催日程・担当講師">
      <ClassesContent />
    </HonbuShell>
  );
}
