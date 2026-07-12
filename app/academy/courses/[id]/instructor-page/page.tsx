"use client";

import { use, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Heading, Image as ImageIcon, Link2, Plus, Trash2, Type, Video } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getCourse } from "@/lib/academy/courses";
import { getInstructorPage, saveInstructorPageBlocks } from "@/lib/academy/instructor-page";
import type { AcademyCourse, AcademyHeadquarters, AcademyPageBlock } from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";

function newBlock(type: AcademyPageBlock["type"]): AcademyPageBlock {
  if (type === "heading") return { type: "heading", text: "" };
  if (type === "image") return { type: "image", url: "", caption: "" };
  if (type === "video") return { type: "video", url: "", caption: "" };
  if (type === "links") return { type: "links", title: "", items: [{ label: "", url: "" }] };
  return { type: "text", text: "" };
}

const BLOCK_LABEL: Record<AcademyPageBlock["type"], string> = {
  heading: "見出し",
  text: "文章",
  image: "画像",
  video: "動画",
  links: "リンク集"
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
    return <textarea className={`${inputClass} min-h-20`} placeholder="本文（開講手順・補足事項など）" value={block.text} onChange={(e) => onChange({ ...block, text: e.target.value })} />;

  if (block.type === "image")
    return (
      <>
        <input className={inputClass} placeholder="画像URL" value={block.url} onChange={(e) => onChange({ ...block, url: e.target.value })} />
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

function BuilderContent({ courseId }: { courseId: string }) {
  const { profile } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [blocks, setBlocks] = useState<AcademyPageBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const foundHq = await getOwnedHeadquarters(profile.user_id);
      setHq(foundHq);
      if (foundHq) {
        setCourse(await getCourse(foundHq.id, courseId));
        const page = await getInstructorPage(foundHq.id, courseId);
        setBlocks(page?.blocks ?? []);
      }
      setLoading(false);
    }
    load();
  }, [profile.user_id, courseId]);

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
    try {
      await saveInstructorPageBlocks(profile, hq.id, course.id, blocks);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq || !course) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">講座が見つかりません。</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="truncate text-xs text-[var(--mikke-muted)]">{course.code} {course.name}</p>
        <h2 className="text-base font-bold text-[var(--mikke-text)]">講師専用ページ</h2>
      </div>
      <p className="rounded-xl bg-[var(--mikke-accent-soft)] px-3 py-2 text-[11px] text-[var(--mikke-accent-strong)]">
        認定講師の復習・共有用ページです。ここで作った内容は、この講座を取得した活動中の講師だけが「講師ホーム」で閲覧できます（受講者・部外者には見えません）。
      </p>

      {blocks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--mikke-line)] bg-white p-6 text-center text-sm text-[var(--mikke-muted)]">
          まだブロックがありません。下のボタンで追加します。
        </p>
      ) : (
        <ul className="space-y-2">
          {blocks.map((block, i) => (
            <li key={i} className="space-y-2 rounded-2xl border border-[var(--mikke-line)] bg-white p-3">
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

      <div className="grid grid-cols-5 gap-1">
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
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded-xl bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {saving ? "保存中…" : "講師専用ページを保存"}
        </button>
        {saved ? <span className="text-xs font-bold text-[var(--mikke-success)]">保存しました</span> : null}
      </div>
    </div>
  );
}

export default function InstructorPageBuilder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <HonbuShell title="講師専用ページ">
      <div className="mx-auto max-w-2xl">
        <BuilderContent courseId={id} />
      </div>
    </HonbuShell>
  );
}
