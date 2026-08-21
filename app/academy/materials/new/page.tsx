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
    requiresActive: true,
    isPublished: true
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
      router.push(toCurrentAcademyContextHref("/academy/materials"));
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
        <p className="text-xs font-bold text-[var(--mikke-accent)]">閲覧設定</p>
        <label className="flex items-center gap-2 text-sm text-[var(--mikke-text)]">
          <input type="checkbox" checked={form.requiresActive} onChange={(e) => set("requiresActive", e.target.checked)} />
          活動中の講師のみ閲覧可（OFFなら認定講師全員）
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--mikke-text)]">
          <input type="checkbox" checked={form.isPublished} onChange={(e) => set("isPublished", e.target.checked)} />
          公開する（講師に見せる）
        </label>
        <p className="text-[11px] text-[var(--mikke-muted)]">この講座を取得した講師だけが閲覧できます（他講座・部外者は見えません）。</p>
      </section>

      {error ? <p className="text-sm font-bold text-[var(--mikke-danger)]">{error}</p> : null}

      <button type="submit" disabled={saving} className="w-full rounded-xl bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
        {saving ? "保存中…" : "教材を追加する"}
      </button>
    </form>
  );
}

export default function NewMaterialPage() {
  return (
    <HonbuShell title="教材を追加">
      <div className="mx-auto max-w-2xl">
        <Suspense fallback={<p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>}>
          <NewMaterialContent />
        </Suspense>
      </div>
    </HonbuShell>
  );
}
