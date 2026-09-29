"use client";
import { academyCourseLabel } from "@/lib/academy/course-display";


import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { Academy2EventForm } from "@/components/academy2/EventForm";
import { useAcademy2Headquarters } from "@/components/academy2/HeadquartersBoundary";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { getAcademyRouteContext, toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { createAcademyClass, type AcademyClassInput } from "@/lib/academy/classes";
import { listCourses } from "@/lib/academy/courses";
import { resolveAcademyCourseFeaturesForCourse } from "@/lib/academy/course-feature-settings";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import type { AcademyCourse, AcademyHeadquarters } from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const labelClass = "block text-xs font-bold text-[var(--mikke-text-soft)]";

function NewAcademyClassContent() {
  const { profile } = useAuth();
  const academyId = getAcademyRouteContext()?.academyId;
  const submitting = useRef(false);
  const [headquarters, setHeadquarters] = useState<AcademyHeadquarters | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createdClassId, setCreatedClassId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AcademyClassInput>({
    courseId: "",
    materialMode: "course_current",
    title: "",
    scheduleMode: "fixed",
    startsAt: "",
    endsAt: null,
    format: "online",
    capacity: null,
    venueName: "",
    meetingUrl: "",
    registrationStatus: "draft"
  });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const foundHeadquarters = await getOwnedHeadquarters(profile.user_id, academyId);
        const foundCourses = foundHeadquarters ? await listCourses(foundHeadquarters.id) : [];
        if (active) { setHeadquarters(foundHeadquarters); setCourses(foundCourses); }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "講座情報を読み込めませんでした。");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [profile.user_id, academyId]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === form.courseId) ?? null,
    [courses, form.courseId]
  );

  function set<K extends keyof AcademyClassInput>(key: K, value: AcademyClassInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setError(null);
    if (!headquarters || !selectedCourse) return setError("講座を選択してください。");
    if (!form.title.trim()) return setError("開催名を入力してください。");
    if (form.scheduleMode === "fixed" && !form.startsAt) return setError("開始日時を入力してください。");
    if (form.endsAt && !form.startsAt) return setError("終了日時を入力する場合は、予定日時も入力してください。");
    if (form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
      return setError("終了日時は開始日時より後にしてください。");
    }

    submitting.current = true; setSaving(true);
    try {
      const created = await createAcademyClass(profile, headquarters.id, selectedCourse, {
        ...form,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null
      });
      setCreatedClassId(created.id);
      // Leave the rewritten creation route only after the insert is confirmed.
      // A document navigation avoids retaining the creation form during a soft transition.
      window.location.assign(toCurrentAcademyContextHref(`/academy/classes?class=${created.id}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "開催日程を作成できませんでした。");
      setSaving(false);
      submitting.current = false;
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!headquarters) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">利用できる本部がありません。</p>;
  if (!courses.length) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">先に講座を作成してください。</p>;
  if (createdClassId) return (
    <section role="status" className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-5">
      <p className="font-bold">開催日程を保存しました。</p>
      <a className="inline-flex min-h-11 items-center text-[var(--mikke-primary)] underline" href={toCurrentAcademyContextHref(`/academy/classes?class=${createdClassId}`)}>開催日程・名簿を開く</a>
    </section>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-accent-soft)] p-4">
        <p className="text-base font-bold text-[var(--mikke-text)]">講座開催日を作成する</p>
        <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">作成後、認定講師にこの開催日の担当を依頼できます。ここで設定した開催日時は、サービスの申込ページには自動で表示されません。</p>
        {form.materialMode === "course_current" ? <p className="mt-2 text-sm">サービスからの申込は、入金確認後に「申込」画面で日程を割り当てます。教材には講座の現在の内容を使います。</p> : selectedCourse && resolveAcademyCourseFeaturesForCourse(selectedCourse).stepLearning ? (
          <p className="mt-2 text-xs font-bold leading-6 text-[var(--mikke-text-soft)]">
            この講座の開催日を作成するには、従来のステップ教材の確定版が必要です。現在のレッスン編集で保存しても、この確定版は作成されません。
          </p>
        ) : selectedCourse ? (
          <p className="mt-2 text-xs font-bold text-[var(--mikke-text-soft)]">この講座はステップ教材を使わないため、そのまま開催日程を作成できます。</p>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-5 md:grid-cols-2">
        <label className={labelClass}>申込と教材の扱い
          <select aria-label="申込と教材の扱い" className={inputClass} value={form.materialMode} onChange={event => set("materialMode", event.target.value as AcademyClassInput["materialMode"])}>
            <option value="course_current">サービスの入金済み申込・現在の教材</option>
            <option value="legacy_program">従来の申込・ステップ教材の確定版</option>
          </select>
        </label>
        <label className={labelClass}>講座*
          <select className={inputClass} value={form.courseId} onChange={(event) => {
            const course = courses.find((item) => item.id === event.target.value);
            setForm((current) => ({ ...current, courseId: event.target.value, title: current.title || (course ? `${course.name} 開催日` : "") }));
          }}>
            <option value="">選択してください</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{academyCourseLabel(course)}</option>)}
          </select>
        </label>
        <label className={labelClass}>開催名*
          <input className={inputClass} value={form.title} onChange={(event) => set("title", event.target.value)} placeholder="例: 2026年9月 オンライン開催" />
        </label>
        <label className={labelClass}>日程の決め方
          <select className={inputClass} value={form.scheduleMode} onChange={(event) => set("scheduleMode", event.target.value as AcademyClassInput["scheduleMode"])}>
            <option value="fixed">日時を決めて募集</option>
            <option value="arranged_after_application">申込後に個別調整</option>
          </select>
        </label>
        <label className={labelClass}>{form.scheduleMode === "fixed" ? "開始日時*" : "予定日時（後から入力）"}
          <input type="datetime-local" className={inputClass} value={form.startsAt} onChange={(event) => set("startsAt", event.target.value)} />
          {form.scheduleMode === "arranged_after_application" ? <span className="mt-1 block text-[11px] font-normal leading-5 text-[var(--mikke-muted)]">申込者と相談して決まった後に入力できます。</span> : null}
        </label>
        <label className={labelClass}>終了日時（任意）
          <input type="datetime-local" className={inputClass} value={form.endsAt ?? ""} onChange={(event) => set("endsAt", event.target.value || null)} />
        </label>
        <label className={labelClass}>形式
          <select className={inputClass} value={form.format} onChange={(event) => set("format", event.target.value as AcademyClassInput["format"])}>
            <option value="online">オンライン</option>
            <option value="in_person">対面</option>
          </select>
        </label>
        {form.format === "online" ? (
          <label className={labelClass}>オンラインURL（任意）
            <input type="url" className={inputClass} value={form.meetingUrl} onChange={(event) => set("meetingUrl", event.target.value)} placeholder="https://..." />
          </label>
        ) : (
          <label className={labelClass}>会場（任意）
            <input className={inputClass} value={form.venueName} onChange={(event) => set("venueName", event.target.value)} />
          </label>
        )}
        <label className={labelClass}>定員（任意）
          <input type="number" min="1" className={inputClass} value={form.capacity ?? ""} onChange={(event) => set("capacity", event.target.value ? Number(event.target.value) : null)} />
        </label>
        <label className={labelClass}>募集状態
          <select className={inputClass} value={form.registrationStatus} onChange={(event) => set("registrationStatus", event.target.value as AcademyClassInput["registrationStatus"])}>
            <option value="draft">下書き</option>
            <option value="open">募集中</option>
            <option value="closed">募集終了</option>
          </select>
        </label>
      </section>

      {error ? <p className="text-sm font-bold text-[var(--mikke-danger)]">{error}</p> : null}
      <button type="submit" disabled={saving} className="w-full rounded-xl bg-[var(--mikke-primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
        {saving ? "作成中…" : "開催日程を作成する"}
      </button>
    </form>
  );
}

function EventCreationBoundary() {
  const headquarters = useAcademy2Headquarters();
  return headquarters ? <Academy2EventForm /> : <NewAcademyClassContent />;
}
export default function NewAcademyClassPage() {
  return <HonbuShell title="開催を追加"><EventCreationBoundary /></HonbuShell>;
}