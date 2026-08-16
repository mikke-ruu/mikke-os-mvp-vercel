"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { AcademyCourseWorkspace } from "@/components/academy/AcademyCourseWorkspace";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getCourse } from "@/lib/academy/courses";
import {
  createCourseProgram,
  createProgramSection,
  createProgramStep,
  deleteProgramStep,
  getCourseProgram,
  listProgramSections,
  updateProgramStep,
  type AcademyProgramSectionWithSteps
} from "@/lib/academy/programs";
import type {
  AcademyCourse,
  AcademyHeadquarters,
  AcademyProgram,
  AcademyProgramStep,
  AcademyProgramStepType
} from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";

const STEP_TYPES: Array<{ value: AcademyProgramStepType; label: string }> = [
  { value: "text", label: "説明" },
  { value: "submission", label: "提出" },
  { value: "live_session", label: "LIVE" },
  { value: "approval", label: "確認・承認" },
  { value: "completion", label: "完了" },
  { value: "external_url", label: "外部リンク" },
  { value: "download", label: "ダウンロード" },
  { value: "test", label: "テスト" }
];

function StepEditor({ step, onSaved, onDeleted }: {
  step: AcademyProgramStep;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [title, setTitle] = useState(step.title);
  const [completionGuide, setCompletionGuide] = useState(step.content ?? "");
  const [type, setType] = useState<AcademyProgramStepType>(step.step_type);
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-2 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} aria-label="ステップ名" />
        <select className={inputClass} value={type} onChange={(event) => setType(event.target.value as AcademyProgramStepType)}>
          {STEP_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>
      <textarea
        className={`${inputClass} min-h-20`}
        value={completionGuide}
        onChange={(event) => setCompletionGuide(event.target.value)}
        placeholder="完了の目安・提出物"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm("このステップを削除しますか？")) return;
            await onDeleted();
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--mikke-danger)] px-3 py-2 text-xs font-bold text-[var(--mikke-danger)]"
        >
          <Trash2 size={14} /> 削除
        </button>
        <button
          type="button"
          disabled={saving || !title.trim()}
          onClick={async () => {
            setSaving(true);
            try {
              await updateProgramStep(step.id, { title, completionGuide, type });
              await onSaved();
            } finally {
              setSaving(false);
            }
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          <Save size={14} /> {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}

function ProgramContent({ courseId }: { courseId: string }) {
  const { profile } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [program, setProgram] = useState<AcademyProgram | null>(null);
  const [sections, setSections] = useState<AcademyProgramSectionWithSteps[]>([]);
  const [title, setTitle] = useState("");
  const [completionGuide, setCompletionGuide] = useState("");
  const [type, setType] = useState<AcademyProgramStepType>("submission");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSections = useCallback(async (programId: string) => {
    setSections(await listProgramSections(programId));
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const foundHq = await getOwnedHeadquarters(profile.user_id);
        setHq(foundHq);
        if (!foundHq) return;
        const foundCourse = await getCourse(foundHq.id, courseId);
        setCourse(foundCourse);
        const foundProgram = await getCourseProgram(foundHq.id, courseId);
        setProgram(foundProgram);
        if (foundProgram) await refreshSections(foundProgram.id);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "ステップ教材の読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId, profile.user_id, refreshSections]);

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq || !course) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">講座が見つかりません。</p>;

  async function startProgram() {
    setSaving(true);
    setError(null);
    try {
      const created = await createCourseProgram(hq!.id, course!.id, course!.name);
      await createProgramSection(created.id, "構築ステップ", 0);
      setProgram(created);
      await refreshSections(created.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ステップ教材を開始できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  async function addStep() {
    if (!program || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let section = sections[0];
      if (!section) {
        const created = await createProgramSection(program.id, "構築ステップ", 0);
        section = { ...created, steps: [] };
      }
      await createProgramStep(section.id, {
        title,
        completionGuide,
        type,
        sortOrder: sections.reduce((count, item) => count + item.steps.length, 0) + 1
      });
      setTitle("");
      setCompletionGuide("");
      await refreshSections(program.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ステップを追加できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  const steps = sections.flatMap((section) => section.steps);

  return (
    <AcademyCourseWorkspace course={course} activeTab="program">
      <div className="space-y-4">
        <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
          <h3 className="text-base font-bold text-[var(--mikke-primary)]">ステップ教材</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">
            タイトルと完了の目安から骨組みを作れます。講座データは、この画面で操作するまで作成されません。
          </p>
          {!program ? (
            <button type="button" disabled={saving} onClick={startProgram} className="mt-4 rounded-xl bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              {saving ? "準備中…" : "ステップ教材を開始する"}
            </button>
          ) : null}
        </section>

        {program ? (
          <>
            <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-[var(--mikke-primary)]">登録済みステップ</h3>
                <span className="text-xs font-bold text-[var(--mikke-muted)]">{steps.length}件</span>
              </div>
              {steps.length === 0 ? <p className="text-xs text-[var(--mikke-muted)]">まだステップはありません。</p> : null}
              {steps.map((step, index) => (
                <div key={step.id} className="grid gap-2 sm:grid-cols-[2rem_minmax(0,1fr)]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--mikke-primary)] text-xs font-bold text-white">{index + 1}</span>
                  <StepEditor
                    step={step}
                    onSaved={() => refreshSections(program.id)}
                    onDeleted={async () => { await deleteProgramStep(step.id); await refreshSections(program.id); }}
                  />
                </div>
              ))}
            </section>

            <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
              <h3 className="text-sm font-bold text-[var(--mikke-primary)]">ステップを追加</h3>
              <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="ステップ名" />
              <textarea className={`${inputClass} min-h-20`} value={completionGuide} onChange={(event) => setCompletionGuide(event.target.value)} placeholder="完了の目安・提出物" />
              <select className={inputClass} value={type} onChange={(event) => setType(event.target.value as AcademyProgramStepType)}>
                {STEP_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <button type="button" disabled={saving || !title.trim()} onClick={addStep} className="inline-flex items-center gap-1 rounded-xl bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                <Plus size={16} /> {saving ? "追加中…" : "ステップを追加"}
              </button>
            </section>
          </>
        ) : null}
        {error ? <p className="text-sm font-bold text-[var(--mikke-danger)]">{error}</p> : null}
      </div>
    </AcademyCourseWorkspace>
  );
}

export default function CourseProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <HonbuShell title="ステップ教材"><ProgramContent courseId={id} /></HonbuShell>;
}
