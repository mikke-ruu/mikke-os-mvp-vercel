"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { listCourses } from "@/lib/academy/courses";
import { createApplication, type ApplicationInput } from "@/lib/academy/applications";
import type { AcademyCourse, AcademyHeadquarters } from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const labelClass = "block text-xs font-bold text-[var(--mikke-text-soft)]";

function NewApplicationContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ApplicationInput>({
    courseId: "",
    intakeSource: "honbu",
    instructorId: null,
    applicantName: "",
    applicantEmail: "",
    applicantPhone: "",
    applicantNote: "",
    eventDate: "",
    format: "",
    price: 0,
    kitCost: 0,
    honbuRevenue: 0,
    instructorRevenue: 0,
    diplomaNameEn: "",
    applicantShippingAddress: ""
  });

  useEffect(() => {
    async function load() {
      const foundHq = await getOwnedHeadquarters(profile.user_id);
      setHq(foundHq);
      if (foundHq) setCourses(await listCourses(foundHq.id));
      setLoading(false);
    }
    load();
  }, [profile.user_id]);

  const selectedCourse = useMemo(() => courses.find((c) => c.id === form.courseId), [courses, form.courseId]);

  function set<K extends keyof ApplicationInput>(key: K, value: ApplicationInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // 講座を選ぶと受講料を初期補完（あとで手修正可）
  function chooseCourse(courseId: string) {
    const course = courses.find((c) => c.id === courseId);
    setForm((prev) => ({
      ...prev,
      courseId,
      price: course ? course.price : prev.price,
      honbuRevenue: prev.intakeSource === "honbu" && course ? course.price : prev.honbuRevenue
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.courseId) return setError("講座を選択してください。");
    if (!form.applicantName.trim()) return setError("受講者名は必須です。");
    setSaving(true);
    try {
      await createApplication(profile, hq!.id, form);
      router.push(toCurrentAcademyContextHref("/academy/applications"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">先に本部を作成してください。</p>;
  if (courses.length === 0)
    return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">先に講座を作成してください。</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <div>
          <label className={labelClass}>講座*</label>
          <select className={inputClass} value={form.courseId} onChange={(e) => chooseCourse(e.target.value)}>
            <option value="">選択してください</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>受付元</label>
          <div className="mt-1 flex gap-2">
            {(["honbu", "koushi"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set("intakeSource", s)}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  form.intakeSource === s
                    ? "border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]"
                    : "border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"
                }`}
              >
                {s === "honbu" ? "本部受付" : "講師受付"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">受講者情報</p>
        <div>
          <label className={labelClass}>受講者名*</label>
          <input className={inputClass} value={form.applicantName} onChange={(e) => set("applicantName", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>メール</label>
            <input className={inputClass} value={form.applicantEmail} onChange={(e) => set("applicantEmail", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>電話</label>
            <input className={inputClass} value={form.applicantPhone} onChange={(e) => set("applicantPhone", e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelClass}>ディプロマに入れるお名前（英語表記）*</label>
          <input className={inputClass} value={form.diplomaNameEn} onChange={(e) => set("diplomaNameEn", e.target.value)} placeholder="例: Taro Yamada" />
        </div>
        <div>
          <label className={labelClass}>メモ（内部用）</label>
          <textarea className={`${inputClass} min-h-16`} value={form.applicantNote} onChange={(e) => set("applicantNote", e.target.value)} />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">開催・金額</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>開催日</label>
            <input type="date" className={inputClass} value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>受講形式</label>
            <select className={inputClass} value={form.format} onChange={(e) => set("format", e.target.value as ApplicationInput["format"])}>
              <option value="">未定</option>
              <option value="in_person">対面</option>
              <option value="online">オンライン</option>
            </select>
          </div>
        </div>
        {form.format === "online" ? (
          <div>
            <label className={labelClass}>配送先情報（オンライン受講時）</label>
            <textarea
              className={`${inputClass} min-h-16`}
              value={form.applicantShippingAddress}
              onChange={(e) => set("applicantShippingAddress", e.target.value)}
              placeholder="キットのお届け先"
            />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>受講料（円）</label>
            <input type="number" min={0} className={inputClass} value={form.price} onChange={(e) => set("price", Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelClass}>キット仕入れ額（円）</label>
            <input type="number" min={0} className={inputClass} value={form.kitCost} onChange={(e) => set("kitCost", Number(e.target.value) || 0)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>本部売上（円）</label>
            <input type="number" min={0} className={inputClass} value={form.honbuRevenue} onChange={(e) => set("honbuRevenue", Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelClass}>講師売上（円）</label>
            <input type="number" min={0} className={inputClass} value={form.instructorRevenue} onChange={(e) => set("instructorRevenue", Number(e.target.value) || 0)} />
          </div>
        </div>
        {selectedCourse ? (
          <p className="text-[11px] text-[var(--mikke-muted)]">
            {selectedCourse.code} の既定受講料 {selectedCourse.price.toLocaleString()}円を補完しました。必要に応じて修正してください。
          </p>
        ) : null}
      </section>

      {error ? <p className="text-sm font-bold text-[var(--mikke-danger)]">{error}</p> : null}

      <button type="submit" disabled={saving} className="w-full rounded-xl bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
        {saving ? "保存中…" : "申込を登録する"}
      </button>
    </form>
  );
}

export default function NewApplicationPage() {
  return (
    <HonbuShell title="申込を追加">
      <div className="mx-auto max-w-2xl">
        <NewApplicationContent />
      </div>
    </HonbuShell>
  );
}
