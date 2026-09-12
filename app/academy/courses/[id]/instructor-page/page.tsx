"use client";

import { use, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  FolderOpen,
  Heading,
  Image as ImageIcon,
  LayoutGrid,
  LayoutPanelLeft,
  Link2,
  MousePointerClick,
  Plus,
  Trash2,
  Type,
  Video
} from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { AcademyCourseWorkspace } from "@/components/academy/AcademyCourseWorkspace";
import { AcademyImageUploader } from "@/components/academy/AcademyImageUploader";
import { EditorPreview } from "@/components/academy/EditorPreview";
import { ManualResources } from "@/components/academy/ManualResources";
import { PrivateMaterialFiles } from "@/components/academy/PrivateMaterialFiles";
import { privateMaterialUiEnabled } from "@/lib/academy/private-material-ui";
import { PageBlocks } from "@/components/academy/PageBlocks";
import { safeImageLink } from "@/components/academy/LinkedImage";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getCourse } from "@/lib/academy/courses";
import { getInstructorPage, saveInstructorPageBlocks } from "@/lib/academy/instructor-page";
import { getLearnerPage, saveLearnerPage } from "@/lib/academy/learner-page";
import type { AcademyCourse, AcademyHeadquarters, AcademyPageBlock, AcademyMaterial } from "@/types/database";

const inputClass =
  "w-full rounded-none border-0 border-b border-transparent bg-transparent px-1 py-2 text-base text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-primary)]";

function ImageLinkField({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  return <label className="block text-xs text-[var(--mikke-muted)]">画像を押したときのリンク（任意）
    <input type="url" className={inputClass} placeholder="https://（材料の購入先など）" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    {value?.trim() && !safeImageLink(value) ? <span role="alert" className="text-[var(--mikke-danger)]">https:// または http:// で始まるURLを入力してください。このままではリンクになりません。</span> : null}
  </label>;
}

function WritingArea({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) { ref.current.style.height = "auto"; ref.current.style.height = `${Math.max(160, ref.current.scrollHeight)}px`; }
  }, [value]);
  return <textarea ref={ref} aria-label="本文" className={`${inputClass} min-h-40 resize-y leading-7`} placeholder="ここから自由に書き始められます。改行や文章の貼り付けもできます。" value={value} onChange={(event) => onChange(event.target.value)} />;
}

function newBlock(type: AcademyPageBlock["type"]): AcademyPageBlock {
  if (type === "heading") return { type: "heading", text: "" };
  if (type === "image") return { type: "image", url: "", caption: "" };
  if (type === "video") return { type: "video", url: "", caption: "" };
  if (type === "links") return { type: "links", title: "", items: [{ label: "", url: "" }] };
  if (type === "image-text") return { type: "image-text", imageUrl: "", heading: "", text: "" };
  if (type === "gallery") return { type: "gallery", images: [] };
  if (type === "cta") return { type: "cta", heading: "", buttonLabel: "", buttonUrl: "" };
  if (type === "materials-list") return { type: "materials-list" };
  return { type: "text", text: "" };
}

const BLOCK_LABEL: Record<AcademyPageBlock["type"], string> = {
  heading: "見出し",
  text: "文章",
  image: "画像",
  video: "動画",
  links: "リンク集",
  "image-text": "画像+文章",
  gallery: "画像グリッド",
  cta: "CTA",
  "materials-list": "教材リスト"
};

function BlockEditor({
  block,
  onChange
}: {
  block: AcademyPageBlock;
  onChange: (b: AcademyPageBlock) => void;
}) {
  if (block.type === "heading")
    return <input className={inputClass} placeholder="見出しテキスト" value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} />;

  if (block.type === "text")
    return <WritingArea value={block.text} onChange={(text) => onChange({ ...block, text })} />;

  if (block.type === "image")
    return (
      <>
        <AcademyImageUploader compact currentUrl={block.url || undefined} onUploaded={(url) => onChange({ ...block, url })} />
        <ImageLinkField value={block.linkUrl} onChange={(linkUrl) => onChange({ ...block, linkUrl })} />
        <input className={inputClass} placeholder="キャプション（任意）" value={block.caption ?? ""} onChange={(e) => onChange({ ...block, caption: e.target.value })} />
      </>
    );

  if (block.type === "video")
    return (
      <>
        <input className={inputClass} placeholder="動画URL（YouTube等）" value={block.url} onChange={(e) => onChange({ ...block, url: e.target.value })} />
        <input className={inputClass} placeholder="キャプション（任意）" value={block.caption ?? ""} onChange={(e) => onChange({ ...block, caption: e.target.value })} />
      </>
    );

  if (block.type === "image-text")
    return (
      <>
        <AcademyImageUploader compact currentUrl={block.imageUrl || undefined} onUploaded={(url) => onChange({ ...block, imageUrl: url })} />
        <ImageLinkField value={block.linkUrl} onChange={(linkUrl) => onChange({ ...block, linkUrl })} />
        <input className={inputClass} placeholder="見出し（任意）" value={block.heading ?? ""} onChange={(e) => onChange({ ...block, heading: e.target.value })} />
        <textarea className={`${inputClass} min-h-16`} placeholder="文章" value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} />
      </>
    );

  if (block.type === "gallery")
    return (
      <div className="space-y-2">
        {block.images.map((img, i) => (
          <div key={i} className="space-y-1 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-2">
            <ImageLinkField value={img.linkUrl} onChange={(linkUrl) => onChange({ ...block, images: block.images.map((x, j) => j === i ? { ...x, linkUrl } : x) })} />
            <AcademyImageUploader
              compact
              currentUrl={img.url || undefined}
              onUploaded={(url) => onChange({ ...block, images: block.images.map((x, j) => (j === i ? { ...x, url } : x)) })}
            />
            <div className="flex items-center gap-1">
              <input
                className={inputClass}
                placeholder="キャプション（任意）"
                value={img.caption ?? ""}
                onChange={(e) => onChange({ ...block, images: block.images.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)) })}
              />
              <button type="button" className="shrink-0 text-[var(--mikke-danger)]" onClick={() => onChange({ ...block, images: block.images.filter((_, j) => j !== i) })}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...block, images: [...block.images, { url: "", caption: "" }] })}
          className="flex items-center gap-1 text-xs font-bold text-[var(--mikke-accent-strong)]"
        >
          <Plus size={13} /> 画像を追加
        </button>
      </div>
    );

  if (block.type === "cta")
    return (
      <>
        <input className={inputClass} placeholder="見出し" value={block.heading} onChange={(e) => onChange({ ...block, heading: e.target.value })} />
        <input className={inputClass} placeholder="ボタンのラベル（例: 詳しく見る）" value={block.buttonLabel} onChange={(e) => onChange({ ...block, buttonLabel: e.target.value })} />
        <input className={inputClass} placeholder="ボタンのリンクURL" value={block.buttonUrl} onChange={(e) => onChange({ ...block, buttonUrl: e.target.value })} />
      </>
    );

  if (block.type === "materials-list")
    return (
      <p className="rounded-xl bg-[var(--mikke-surface-soft)] px-3 py-2 text-xs text-[var(--mikke-muted)]">
        設定項目はありません。「講師用ファイル」でマイポータルに表示する設定にしたPDF・動画・リンクが、ここに自動で一覧表示されます。
      </p>
    );

  // links（リンク集）
  return (
    <div className="space-y-2">
      <input className={inputClass} placeholder="リンク集の見出し（例: 仕入れ先リンク）" value={block.title ?? ""} onChange={(e) => onChange({ ...block, title: e.target.value })} />
      {block.items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            className={inputClass}
            placeholder="表示名"
            value={item.label}
            onChange={(e) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
          />
          <input
            className={inputClass}
            placeholder="URL"
            value={item.url}
            onChange={(e) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })}
          />
          <button type="button" className="shrink-0 text-[var(--mikke-danger)]" onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...block, items: [...block.items, { label: "", url: "" }] })}
        className="flex items-center gap-1 text-xs font-bold text-[var(--mikke-accent-strong)]"
      >
        <Plus size={13} /> リンクを追加
      </button>
    </div>
  );
}

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

  function update(i: number, b: AcademyPageBlock) {
    setBlocks((prev) => prev.map((x, j) => (j === i ? b : x)));
    setSaved(false);
  }
  function move(i: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSaved(false);
  }
  function add(type: AcademyPageBlock["type"]) {
    setBlocks((prev) => [...prev, newBlock(type)]);
    setSaved(false);
  }
  function remove(i: number) {
    setBlocks((prev) => prev.filter((_, j) => j !== i));
    setSaved(false);
  }

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
      {blocks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white p-6 text-center text-sm text-[var(--mikke-muted)]">
          <button type="button" className="min-h-11 text-[var(--mikke-primary)]" onClick={() => add("text")}>ここから文章を書き始める ＋</button>
        </p>
      ) : (
        <ul className="space-y-2">
          {blocks.map((block, i) => block.type === "materials-list" ? null : (
            <li key={i} className="group space-y-2 border-b border-[var(--mikke-line)] bg-white py-5">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[var(--mikke-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">{BLOCK_LABEL[block.type]}</span>
                <div className="flex items-center gap-2 text-[var(--mikke-muted)]">
                  <button type="button" onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
                  <button type="button" onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
                  <button type="button" onClick={() => remove(i)} className="text-[var(--mikke-danger)]"><Trash2 size={15} /></button>
                </div>
              </div>
              <BlockEditor block={block} onChange={(b) => update(i, b)} />
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-3 gap-1">
        <button type="button" onClick={() => add("heading")} className="flex flex-col items-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white py-2 text-[10px] font-bold text-[var(--mikke-text-soft)]">
          <Heading size={14} /> 見出し
        </button>
        <button type="button" onClick={() => add("text")} className="flex flex-col items-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white py-2 text-[10px] font-bold text-[var(--mikke-text-soft)]">
          <Type size={14} /> 文章
        </button>
        <button type="button" onClick={() => add("image")} className="flex flex-col items-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white py-2 text-[10px] font-bold text-[var(--mikke-text-soft)]">
          <ImageIcon size={14} /> 画像
        </button>
        <button type="button" onClick={() => add("video")} className="flex flex-col items-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white py-2 text-[10px] font-bold text-[var(--mikke-text-soft)]">
          <Video size={14} /> 動画
        </button>
        <button type="button" onClick={() => add("links")} className="flex flex-col items-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white py-2 text-[10px] font-bold text-[var(--mikke-text-soft)]">
          <Link2 size={14} /> リンク集
        </button>
        <button type="button" onClick={() => add("image-text")} className="flex flex-col items-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white py-2 text-[10px] font-bold text-[var(--mikke-text-soft)]">
          <LayoutPanelLeft size={14} /> 画像+文章
        </button>
        <button type="button" onClick={() => add("gallery")} className="flex flex-col items-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white py-2 text-[10px] font-bold text-[var(--mikke-text-soft)]">
          <LayoutGrid size={14} /> 画像グリッド
        </button>
        <button type="button" onClick={() => add("cta")} className="flex flex-col items-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white py-2 text-[10px] font-bold text-[var(--mikke-text-soft)]">
          <MousePointerClick size={14} /> CTA
        </button>
      </div>
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
