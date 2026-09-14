"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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

  useEffect(() => {
    async function load() {
      const foundHq = await getOwnedHeadquarters(profile.user_id);
      setHq(foundHq);
      if (foundHq) {
        setCourse(await getCourse(foundHq.id, courseId));
        if (audience === "learner") {
          const page = await getLearnerPage(foundHq.id, courseId);
          setLearnerPageId(page?.id ?? null);
          setBlocks(page?.blocks ?? []);
          setIsPublished(page?.is_published ?? false);
        } else {
          const page = await getInstructorPage(foundHq.id, courseId);
          setBlocks(page?.blocks ?? []);
          setIsPublished(true);
        }
      }
      setLoading(false);
    }
    load();
  }, [audience, profile.user_id, courseId]);

  async function save() {
    if (!hq || !course) return;
    setSaving(true);
    setSaveError("");
    try {
      if (audience === "learner") {
        const page = await saveLearnerPage(profile, hq.id, course.id, blocks, isPublished);
        setLearnerPageId(page.id);
      } else {
        await saveInstructorPageBlocks(profile, hq.id, course.id, blocks);
      }
      setSaved(true);
    } catch {
      setSaveError("保存できませんでした。入力内容はこの画面に残っています。通信状態を確認して、もう一度保存してください。");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq || !course) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">講座が見つかりません。</p>;

  return (
    <AcademyCourseWorkspace course={course} activeTab={audience}>
      <div className="space-y-4">
      <div>
        <p className="truncate text-xs text-[var(--mikke-muted)]">{course.code} {course.name}</p>
        <h2 className="text-base font-bold text-[var(--mikke-text)]">{audience === "learner" ? "講座復習ページ" : "講師マニュアルページ"}</h2>
      </div>
      <p className="rounded-xl bg-[var(--mikke-accent-soft)] px-4 py-3 text-sm font-bold leading-6 text-[var(--mikke-text)]">
        {audience === "learner"
          ? "受講した人が、講座の振り返りや配布資料、本部からのお知らせを確認するページです。認定講師用の資料とは別です。"
          : "講座の進め方、材料の購入先、営業方法などを、この講座の認定講師に共有するページです。受講者の講座復習ページとは別です。"}
      </p>

      {audience === "learner" ? (
        <fieldset className="rounded-xl border border-[var(--mikke-line)] bg-white p-4">
          <legend className="px-1 text-xs font-bold text-[var(--mikke-text)]">受講者への表示</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {([
              [false, "下書き（まだ受講者に表示しない）"],
              [true, "受講者のマイポータルに表示"]
            ] as const).map(([value, label]) => (
              <label key={String(value)} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold ${isPublished === value ? "border-[var(--mikke-primary)] bg-[var(--mikke-accent-soft)] text-[var(--mikke-primary)]" : "border-[var(--mikke-line)] text-[var(--mikke-text-soft)]"}`}>
                <input type="radio" name="learner-page-publication" checked={isPublished === value} onChange={() => { setIsPublished(value); setSaved(false); }} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <EditorPreview preview={<PageBlocks blocks={[...blocks.filter((block) => block.type !== "materials-list"), ...(audience === "instructor" && previewMaterials.some((material) => material.is_published) ? [{ type: "materials-list" } as const] : [])]} materials={previewMaterials.filter((material) => material.is_published)} />}>
      <AcademyContentEditor blocks={blocks} onChange={next => { setBlocks(next); setSaved(false); }} />
      {audience === "instructor" ? <section id="resources" className="border-t border-[var(--mikke-line)] pt-6"><ManualResources courseId={course.id} onChange={setPreviewMaterials} /></section> : null}
      {audience === "learner" && privateMaterialUiEnabled ? <section className="border-t border-[var(--mikke-line)] py-4"><h3 className="font-bold">受講生向けPDF資料</h3>{learnerPageId ? <PrivateMaterialFiles parent={{ audience: "learner", parentId: learnerPageId }} editable /> : <p className="mt-2 text-sm">最初に講座復習ページを保存すると、PDFを追加できます。</p>}</section> : null}
      </EditorPreview>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded-xl bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {saving ? "保存中…" : audience === "learner" ? "講座復習ページを保存" : "講師マニュアルページを保存"}
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
    <HonbuShell title={audience === "learner" ? "講座復習ページ" : "講師マニュアルページ"}>
      <BuilderContent key={`${id}:${audience}`} courseId={id} audience={audience} />
    </HonbuShell>
  );
}
