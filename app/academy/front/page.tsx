"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, LayoutTemplate } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { AcademyImageUploader } from "@/components/academy/AcademyImageUploader";
import { AcademyLpEditor } from "@/components/academy/AcademyLpEditor";
import { getOwnedHeadquarters, updateHeadquarters } from "@/lib/academy/headquarters";
import { listCourses } from "@/lib/academy/courses";
import type { AcademyCourse, AcademyHeadquarters, AcademyLpBlock } from "@/types/database";

const inputClass =
  "min-w-0 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-base text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)] sm:text-sm";
const labelClass = "block text-xs font-bold text-[var(--mikke-text-soft)]";

function FrontContent() {
  const { profile } = useAuth();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const revision = useRef(0);

  const [form, setForm] = useState({
    name: "",
    tagline: "",
    front_message: "",
    hero_image_url: "",
    contact_email: ""
  });
  // Wave F (AC-F3): 既存hqデータはfront_blocks列が無いため undefined→[] フォールバック必須。
  const [blocks, setBlocks] = useState<AcademyLpBlock[]>([]);

  useEffect(() => {
    async function load() {
      const foundHq = await getOwnedHeadquarters(profile.user_id);
      setHq(foundHq);
      if (foundHq) {
        setForm({
          name: foundHq.name,
          tagline: foundHq.tagline ?? "",
          front_message: foundHq.front_message ?? "",
          hero_image_url: foundHq.hero_image_url ?? "",
          contact_email: foundHq.contact_email ?? ""
        });
        setBlocks(foundHq.front_blocks ?? []);
        setCourses(await listCourses(foundHq.id));
      }
      setLoading(false);
    }
    void load().catch(() => {
      setSaveError("ホームページを読み込めませんでした。ページを再読み込みしてください。");
      setLoading(false);
    });
  }, [profile.user_id]);

  function set(key: keyof typeof form, value: string) {
    revision.current += 1;
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleBlocksChange(next: AcademyLpBlock[]) {
    revision.current += 1;
    setBlocks(next);
    setSaved(false);
  }

  async function save() {
    if (!hq) return;
    const savingRevision = revision.current;
    setSaving(true);
    setSaveError("");
    try {
      await updateHeadquarters(hq.id, {
        name: form.name.trim() || hq.name,
        tagline: form.tagline || null,
        front_message: form.front_message || null,
        hero_image_url: form.hero_image_url || null,
        contact_email: form.contact_email || null,
        front_blocks: blocks
      });
      setSaved(revision.current === savingRevision);
    } catch {
      setSaveError("保存できませんでした。入力内容は残っています。時間をおいてもう一度保存してください。");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq) return <p role={saveError ? "alert" : undefined} className="py-16 text-center text-sm text-[var(--mikke-muted)]">{saveError || "先に本部を作成してください。"}</p>;

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-4">
      {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-bold leading-6 text-[var(--mikke-text)]">本部全体を紹介するホームページを編集します。各講座の講座ページとは別のページです。</p>
        <Link
          href={`/academy/site/${encodeURIComponent(hq.handle)}`}
          target="_blank"
          className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--mikke-line)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--mikke-accent)]"
        >
          <ExternalLink size={13} /> 保存済みのホームページを見る
        </Link>
      </div>

      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">ヒーローエリア</p>
        <div>
          <label className={labelClass}>アカデミー名</label>
          <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>キャッチコピー</label>
          <input
            className={inputClass}
            value={form.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            placeholder="わたしらしい学びで、誰かの未来を照らす。"
          />
        </div>
        <div>
          <label className={labelClass}>紹介文</label>
          <textarea
            className={`${inputClass} min-h-20`}
            value={form.front_message}
            onChange={(e) => set("front_message", e.target.value)}
            placeholder="一人ひとりの「気づき」と「可能性」を大切にする認定講座プラットフォームです。"
          />
        </div>
        <div>
          <label className={labelClass}>メイン画像</label>
          <AcademyImageUploader currentUrl={form.hero_image_url || undefined} onUploaded={(url) => set("hero_image_url", url)} />
        </div>
        <div>
          <label className={labelClass}>お問い合わせメール</label>
          <input className={inputClass} value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="rounded-xl bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {saving ? "保存中…" : "保存する"}
          </button>
          {saved ? <span className="text-xs font-bold text-[var(--mikke-success)]">保存しました</span> : null}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5">
        <p className="text-xs font-bold text-[var(--mikke-accent)]">ホームページの本文</p>
        <p className="text-[11px] text-[var(--mikke-muted)]">
          メイン画像と講座一覧の間に表示されます。「＋」から文章・画像・動画などを挿入し、自由に組み立てられます。
        </p>

        <AcademyLpEditor blocks={blocks} onChange={handleBlocksChange} title={form.name} />

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="rounded-xl bg-[var(--mikke-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {saving ? "保存中…" : "保存する"}
          </button>
          {saved ? <span className="text-xs font-bold text-[var(--mikke-success)]">保存しました</span> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5">
        <p className="text-sm font-bold text-[var(--mikke-text)]">講座ページ</p>
        <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">講座情報を編集できます。お客様向けの紹介と申込受付は「募集」で作成・公開します。</p>
        <ul className="mt-3 space-y-2">
          {courses.map((c) => (
            <li key={c.id} className="flex min-w-0 flex-col items-stretch gap-2 rounded-xl border border-[var(--mikke-line)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--mikke-text)]">
                  {c.code} {c.name}
                </p>
              </div>
              <Link
                href={`/academy/courses/${c.id}`}
                className="flex shrink-0 items-center justify-center gap-1 rounded-full bg-[var(--mikke-accent-soft)] px-3 py-2 text-xs font-bold text-[var(--mikke-accent-strong)]"
              >
                <LayoutTemplate size={13} /> 講座情報を編集
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function FrontEditPage() {
  return (
    <HonbuShell title="ホームページ編集">
      <FrontContent />
    </HonbuShell>
  );
}
