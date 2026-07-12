"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink, Heading, Image as ImageIcon, Plus, Trash2, Type } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getCourse } from "@/lib/academy/courses";
import { saveLpBlocks } from "@/lib/academy/lp";
import type { AcademyCourse, AcademyHeadquarters, AcademyLpBlock } from "@/types/database";

const inputClass =
  "w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)]";

function newBlock(type: AcademyLpBlock["type"]): AcademyLpBlock {
  if (type === "heading") return { type: "heading", text: "" };
  if (type === "image") return { type: "image", url: "", caption: "" };
  return { type: "text", text: "" };
}

function LpBuilderContent({ courseId }: { courseId: string }) {
  const { profile } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [blocks, setBlocks] = useState<AcademyLpBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const foundHq = await getOwnedHeadquarters(profile.user_id);
      setHq(foundHq);
      if (foundHq) {
        const found = await getCourse(foundHq.id, courseId);
        setCourse(found);
        setBlocks(found.lp_blocks ?? []);
      }
      setLoading(false);
    }
    load();
  }, [profile.user_id, courseId]);

  function update(i: number, patch: Partial<AcademyLpBlock>) {
    setBlocks((prev) => prev.map((b, j) => (j === i ? ({ ...b, ...patch } as AcademyLpBlock) : b)));
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
  function add(type: AcademyLpBlock["type"]) {
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
      await saveLpBlocks(hq.id, course.id, blocks);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq || !course) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">講座が見つかりません。</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-[var(--mikke-muted)]">{course.code} {course.name}</p>
          <h2 className="text-base font-bold text-[var(--mikke-text)]">LPビルダー</h2>
        </div>
        <Link href={`/academy/c/${course.id}`} target="_blank" className="flex items-center gap-1 rounded-full border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-accent-strong)]">
          <ExternalLink size={14} /> 公開LPを見る
        </Link>
      </div>

      <p className="rounded-xl bg-[var(--mikke-accent-soft)] px-3 py-2 text-[11px] text-[var(--mikke-accent-strong)]">
        受講料・認定条件・キット・FAQなどは講座の基本情報がそのままLPに表示されます。ここでは自由なブロック（見出し・文章・画像）を追加します。
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
                <span className="rounded-full bg-[var(--mikke-accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--mikke-accent-strong)]">
                  {block.type === "heading" ? "見出し" : block.type === "image" ? "画像" : "文章"}
                </span>
                <div className="flex items-center gap-2 text-[var(--mikke-muted)]">
                  <button type="button" onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
                  <button type="button" onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
                  <button type="button" onClick={() => remove(i)} className="text-[var(--mikke-danger)]"><Trash2 size={15} /></button>
                </div>
              </div>
              {block.type === "heading" ? (
                <input className={inputClass} placeholder="見出しテキスト" value={block.text} onChange={(e) => update(i, { text: e.target.value })} />
              ) : block.type === "text" ? (
                <textarea className={`${inputClass} min-h-20`} placeholder="本文" value={block.text} onChange={(e) => update(i, { text: e.target.value })} />
              ) : (
                <>
                  <input className={inputClass} placeholder="画像URL" value={block.url} onChange={(e) => update(i, { url: e.target.value })} />
                  <input className={inputClass} placeholder="キャプション（任意）" value={block.caption ?? ""} onChange={(e) => update(i, { caption: e.target.value })} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={() => add("heading")} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white py-2 text-xs font-bold text-[var(--mikke-text-soft)]">
          <Heading size={14} /> 見出し
        </button>
        <button type="button" onClick={() => add("text")} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white py-2 text-xs font-bold text-[var(--mikke-text-soft)]">
          <Type size={14} /> 文章
        </button>
        <button type="button" onClick={() => add("image")} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white py-2 text-xs font-bold text-[var(--mikke-text-soft)]">
          <ImageIcon size={14} /> 画像
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded-xl bg-[var(--mikke-accent)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {saving ? "保存中…" : "LPを保存する"}
        </button>
        {saved ? <span className="text-xs font-bold text-[var(--mikke-success)]">保存しました</span> : null}
      </div>
    </div>
  );
}

export default function LpBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <HonbuShell title="LPビルダー">
      <div className="mx-auto max-w-2xl">
        <LpBuilderContent courseId={id} />
      </div>
    </HonbuShell>
  );
}
