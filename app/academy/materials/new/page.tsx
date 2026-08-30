"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { listCourses } from "@/lib/academy/courses";
import { MATERIAL_KIND_LABELS, createMaterial, type MaterialInput } from "@/lib/academy/materials";
import type { AcademyCourse, AcademyHeadquarters, AcademyMaterial } from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";
const labelClass = "block text-xs font-bold text-[var(--mikke-text-soft)]";

function NewMaterialContent() {
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const router = useRouter();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<MaterialInput>({
    courseId: searchParams.get("course") ?? "",
    kind: "pdf",
    title: "",
    url: "",
    description: "",
    requiresActive: false,
    isPublished: false
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

  function set<K extends keyof MaterialInput>(key: K, value: MaterialInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.courseId) return setError("講座を選択してください。");
    if (!form.title.trim() || !form.url.trim()) return setError("タイトルとURLは必須です。");
    setSaving(true);
    try {
      await createMaterial(profile, hq!.id, form);
      router.push(toCurrentAcademyContextHref(`/academy/materials?course=${encodeURIComponent(form.courseId)}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">先に本部を作成してください。</p>;
  if (courses.length === 0) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">先に講座を作成してください。</p>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <div>
          <label className={labelClass}>講座*</label>
          <select className={inputClass} value={form.courseId} onChange={(e) => set("courseId", e.target.value)}>
            <option value="">選択してください</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>種別</label>
          <div className="mt-1 flex gap-2">
            {(Object.keys(MATERIAL_KIND_LABELS) as AcademyMaterial["kind"][]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => set("kind", k)}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  form.kind === k ? "border-[var(--mikke-accent)] bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"
                }`}
              >
                {MATERIAL_KIND_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>タイトル*</label>
          <input className={inputClass} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="CACM公式テキスト" />
        </div>
        <div>
          <label className={labelClass}>URL*（PDF/動画/リンク先）</label>
          <input className={inputClass} value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label className={labelClass}>説明</label>
          <textarea className={`${inputClass} min-h-16`} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">講師用ファイルの表示設定</p>
        <div>
          <p className={labelClass}>見せる講師</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {([
              [false, "この講座の認定講師全員"],
              [true, "活動中の講師だけ"]
            ] as const).map(([value, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={form.requiresActive === value}
                onClick={() => set("requiresActive", value)}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-bold ${form.requiresActive === value ? "border-[#3f4eb5] bg-[#3f4eb5] text-white" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-text)]"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={labelClass}>表示状態</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {([
              [false, "下書き（まだ講師に表示しない）"],
              [true, "講師のマイポータルに表示"]
            ] as const).map(([value, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={form.isPublished === value}
                onClick={() => set("isPublished", value)}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-bold ${form.isPublished === value ? "border-[#3f4eb5] bg-[#3f4eb5] text-white" : "border-[var(--mikke-line)] bg-white text-[var(--mikke-text)]"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm leading-6 text-[var(--mikke-muted)]">この講座の認定講師だけが見られます。他の講座の講師や受講者には表示されません。</p>
      </section>

      {error ? <p className="text-sm font-bold text-[var(--mikke-danger)]">{error}</p> : null}

      <button type="submit" disabled={saving} className="w-full rounded-xl bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
        {saving ? "保存中…" : "講師用ファイルを追加する"}
      </button>
    </form>
  );
}

export default function NewMaterialPage() {
  return (
    <HonbuShell title="講師用ファイルを追加">
      <div className="mx-auto max-w-2xl">
        <Suspense fallback={<p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>}>
          <NewMaterialContent />
        </Suspense>
      </div>
    </HonbuShell>
  );
}
