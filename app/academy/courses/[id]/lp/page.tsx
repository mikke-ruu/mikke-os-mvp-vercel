"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { LpBlocksEditor } from "@/components/academy/LpBlocksEditor";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { getCourse } from "@/lib/academy/courses";
import { saveLpBlocks } from "@/lib/academy/lp";
import type { AcademyCourse, AcademyHeadquarters, AcademyLpBlock } from "@/types/database";

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

  function handleBlocksChange(next: AcademyLpBlock[]) {
    setBlocks(next);
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
        受講料・認定条件・キット・FAQなどは講座の基本情報がそのままLPに表示されます。ここでは自由なブロック（見出し・文章・画像・画像+文章・画像グリッド・CTA）を追加します。
      </p>

      <LpBlocksEditor blocks={blocks} onChange={handleBlocksChange} />

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
