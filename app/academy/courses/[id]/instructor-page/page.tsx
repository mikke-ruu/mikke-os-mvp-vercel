"use client";

import { use, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AcademyLessonEditor } from "@/components/academy/AcademyLessonEditor";
import { readLessons, writeLessons } from "@/lib/academy/lesson-content";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { AcademyCourseWorkspace } from "@/components/academy/AcademyCourseWorkspace";
import { AcademyContentEditor } from "@/components/academy/AcademyContentEditor";
import { EditorPreview } from "@/components/academy/EditorPreview";
import { ManualResources } from "@/components/academy/ManualResources";
import { PrivateMaterialFiles } from "@/components/academy/PrivateMaterialFiles";
import { privateMaterialUiEnabled } from "@/lib/academy/private-material-ui";
import { PageBlocks } from "@/components/academy/PageBlocks";

import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getCourse } from "@/lib/academy/courses";
import { getInstructorPage, saveInstructorPageBlocks } from "@/lib/academy/instructor-page";
import { getLearnerPage, saveLearnerPage } from "@/lib/academy/learner-page";
import type { AcademyCourse, AcademyHeadquarters, AcademyPageBlock, AcademyMaterial } from "@/types/database";

function BuilderContent({ courseId, audience }: { courseId: string; audience: "learner" | "instructor" }) {
  const { profile } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [blocks, setBlocks] = useState<AcademyPageBlock[]>([]);
  const [previewMaterials, setPreviewMaterials] = useState<AcademyMaterial[]>([]);
  const [learnerPageId, setLearnerPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const revision = useRef(0);
  const savePending = useRef(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
      const foundHq = await getOwnedHeadquarters(profile.user_id);
      if (cancelled) return;
      setHq(foundHq);
      if (foundHq) {
        const loadedCourse = await getCourse(foundHq.id, courseId);
        if (cancelled) return;
        setCourse(loadedCourse);
        if (audience === "learner") {
          const page = await getLearnerPage(foundHq.id, courseId);
          if (cancelled) return;
          setLearnerPageId(page?.id ?? null);
          const existingBlocks = page?.blocks ?? [];
          setBlocks(existingBlocks.length ? existingBlocks : writeLessons(readLessons([], loadedCourse?.feature_settings?.marketing?.curriculum ?? [])));
          setIsPublished(page?.is_published ?? false);
        } else {
          const page = await getInstructorPage(foundHq.id, courseId);
          if (cancelled) return;
          setBlocks(page?.blocks ?? []);
          setIsPublished(true);
        }
      }
      } catch {
        if (!cancelled) setLoadError("教材を読み込めませんでした。画面を再読み込みしてください。");
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [audience, profile.user_id, courseId]);

  async function save() {
    if (!hq || !course || savePending.current) return;
    savePending.current = true;
    const savingRevision = revision.current;
    setSaving(true);
    setSaveError("");
    try {
      if (audience === "learner") {
        const page = await saveLearnerPage(profile, hq.id, course.id, blocks, isPublished);
        setLearnerPageId(page.id);
      } else {
        await saveInstructorPageBlocks(profile, hq.id, course.id, blocks);
      }
      setSaved(revision.current === savingRevision);
    } catch {
      setSaveError("保存できませんでした。入力内容はこの画面に残っています。通信状態を確認して、もう一度保存してください。");
    } finally {
      savePending.current = false;
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (loadError) return <p role="alert" className="py-10 text-center text-sm text-[var(--mikke-danger)]">{loadError}</p>;
  if (!hq || !course) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">講座が見つかりません。</p>;

  return (
    <AcademyCourseWorkspace course={course} activeTab={audience}>
      <div className="space-y-4">
      {audience === "learner" ? <>
        <AcademyLessonEditor blocks={blocks} curriculum={[]} onChange={next => { revision.current += 1; setBlocks(next); setSaved(false); }} />
        <div className="flex justify-end"><Link className="inline-flex min-h-11 items-center rounded-lg border border-[var(--mikke-line)] bg-white px-4 text-sm font-bold" href={toCurrentAcademyContextHref(`/academy/courses/${course.id}`)}>講座情報に戻る</Link></div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={isPublished} onChange={event => { revision.current += 1; setIsPublished(event.target.checked); setSaved(false); }} />受講者のマイページに表示する</label>
        {privateMaterialUiEnabled && <details className="border-t border-[var(--mikke-line)] py-4"><summary className="min-h-11 cursor-pointer text-sm font-bold">受講生向けPDF資料</summary>{learnerPageId ? <PrivateMaterialFiles parent={{ audience: "learner", parentId: learnerPageId }} editable /> : <p className="mt-2 text-sm">教材を保存すると、PDFを追加できます。</p>}</details>}
      </> : <>
      <div>
        <p className="truncate text-xs text-[var(--mikke-muted)]">{course.code} {course.name}</p>
        <h2 className="text-base font-bold text-[var(--mikke-text)]">講師マニュアル</h2>
      </div>
      <p className="rounded-xl bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm font-bold leading-6 text-[var(--mikke-text)]">
        講座の進め方や材料の購入先を、認定講師に共有します。受講者用のレッスン教材とは別です。
      </p>

      <EditorPreview preview={<PageBlocks blocks={[...blocks.filter((block) => block.type !== "materials-list"), ...(audience === "instructor" && previewMaterials.some((material) => material.is_published) ? [{ type: "materials-list" } as const] : [])]} materials={previewMaterials.filter((material) => material.is_published)} />}>
      <AcademyContentEditor blocks={blocks} onChange={next => { revision.current += 1; setBlocks(next); setSaved(false); }} />
      {audience === "instructor" ? <section id="resources" className="border-t border-[var(--mikke-line)] pt-6"><ManualResources courseId={course.id} onChange={setPreviewMaterials} /></section> : null}
      </EditorPreview>
      </>}
      <div className="flex items-center justify-end gap-3 rounded-xl border border-[var(--mikke-line)] bg-white p-4">
        <button onClick={save} disabled={saving} className="rounded-xl bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {saving ? "保存中…" : "保存する"}
        </button>
        {saved ? <span className="text-xs font-bold text-[var(--mikke-success)]">保存しました</span> : null}
      </div>
      {saveError ? <p role="alert" className="text-sm text-[var(--mikke-danger)]">{saveError}</p> : null}
      </div>
    </AcademyCourseWorkspace>
  );
}

export default function InstructorPageBuilder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const audience = searchParams.get("audience") === "learner" ? "learner" : "instructor";
  return (
    <HonbuShell title={audience === "learner" ? "レッスン教材" : "講師マニュアル"}>
      <BuilderContent key={`${id}:${audience}`} courseId={id} audience={audience} />
    </HonbuShell>
  );
}
