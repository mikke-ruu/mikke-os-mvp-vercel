"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { createAcademyClass, type AcademyClassInput } from "@/lib/academy/classes";
import { listCourses } from "@/lib/academy/courses";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import type { AcademyCourse, AcademyHeadquarters } from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const labelClass = "block text-xs font-bold text-[var(--mikke-text-soft)]";

function NewAcademyClassContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [headquarters, setHeadquarters] = useState<AcademyHeadquarters | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AcademyClassInput>({
    courseId: "",
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
    async function load() {
      try {
        const foundHeadquarters = await getOwnedHeadquarters(profile.user_id);
        setHeadquarters(foundHeadquarters);
        if (foundHeadquarters) setCourses(await listCourses(foundHeadquarters.id));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "講座情報を読み込めませんでした。");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [profile.user_id]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === form.courseId) ?? null,
    [courses, form.courseId]
  );

  function set<K extends keyof AcademyClassInput>(key: K, value: AcademyClassInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!headquarters || !selectedCourse) return setError("講座を選択してください。");
    if (!form.title.trim()) return setError("クラス名を入力してください。");
    if (!form.startsAt) return setError("開始日時を入力してください。");
    if (form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
      return setError("終了日時は開始日時より後にしてください。");
    }

    setSaving(true);
    try {
      await createAcademyClass(profile, headquarters.id, selectedCourse, {
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null
      });
      router.push(toCurrentAcademyContextHref("/academy/classes"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "クラスを作成できませんでした。");
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!headquarters) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">利用できる本部がありません。</p>;
  if (!courses.length) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">先に講座を作成してください。</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-accent-soft)] p-4">
        <p className="text-sm font-bold text-[var(--mikke-text)]">講座を開催する単位を作ります</p>
        <p className="mt-1 text-xs text-[var(--mikke-muted)]">クラス作成後に、同じ講座の認定講師へ担当を依頼できます。作成しただけでは公開されません。</p>
        {selectedCourse ? (
          <Link
            href={toCurrentAcademyContextHref(`/academy/courses/${selectedCourse.id}/program`)}
            className="mt-2 inline-block text-xs font-bold text-[var(--mikke-accent-strong)]"
          >
            ステップ教材を作成・確定する
          </Link>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-2xl border border-[var(--mikke-line)] bg-white p-5 md:grid-cols-2">
        <label className={labelClass}>講座*
          <select className={inputClass} value={form.courseId} onChange={(event) => {
            const course = courses.find((item) => item.id === event.target.value);
            setForm((current) => ({ ...current, courseId: event.target.value, title: current.title || (course ? `${course.name} クラス` : "") }));
          }}>
            <option value="">選択してください</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.code} {course.name}</option>)}
          </select>
        </label>
        <label className={labelClass}>クラス名*
          <input className={inputClass} value={form.title} onChange={(event) => set("title", event.target.value)} placeholder="例: 2026年9月 オンラインクラス" />
        </label>
        <label className={labelClass}>日程の決め方
          <select className={inputClass} value={form.scheduleMode} onChange={(event) => set("scheduleMode", event.target.value as AcademyClassInput["scheduleMode"])}>
            <option value="fixed">日時を決めて募集</option>
            <option value="arranged_after_application">申込後に個別調整</option>
          </select>
        </label>
        <label className={labelClass}>{form.scheduleMode === "fixed" ? "開始日時*" : "管理上の予定日時*"}
          <input type="datetime-local" className={inputClass} value={form.startsAt} onChange={(event) => set("startsAt", event.target.value)} />
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
        {saving ? "作成中…" : "非公開でクラスを作成する"}
      </button>
    </form>
  );
}

export default function NewAcademyClassPage() {
  return <HonbuShell title="クラスを作成"><NewAcademyClassContent /></HonbuShell>;
}
