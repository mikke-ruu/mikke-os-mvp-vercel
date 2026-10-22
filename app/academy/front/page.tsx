"use client";
import {HeadquartersHomepageEditor} from '@/components/academy2/HeadquartersHomepageEditor';
import {CreationReturnLink} from '@/components/academy2/CreationReturnLink';
import { academyCourseLabel } from "@/lib/academy/course-display";


import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, LayoutTemplate } from "lucide-react";
import { useAuth } from "@/components/AuthGate";
import { useAcademy2Headquarters } from "@/components/academy2/HeadquartersBoundary";
import { getHeadquartersFront, saveHeadquartersFront, type HeadquartersFront } from "@/lib/academy2/headquarters-front";
import { listAcademy2Courses } from "@/lib/academy2/courses";
import { toAcademyContextHref } from "@/lib/academy/access-context";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { AcademyImageUploader } from "@/components/academy/AcademyImageUploader";
import { AcademyLpEditor } from "@/components/academy/AcademyLpEditor";
import { getOwnedHeadquarters, updateHeadquarters } from "@/lib/academy/headquarters";
import {getAcademyRouteContext} from "@/lib/academy/access-context";
import {getMusubiLegacyPaidAdapter} from "@/lib/academy/musubi-legacy-adapter";
import { listCourses } from "@/lib/academy/courses";
import type { AcademyCourse, AcademyHeadquarters, AcademyLpBlock } from "@/types/database";

import { frontMaxWidth, defaultFrontDesign, readFrontDocument, writeFrontDocument, type AcademyFrontDesign } from "@/lib/academy/front-design";
import { AcademyFrontDesignEditor } from "@/components/academy/AcademyFrontDesignEditor";
import { AcademyFrontHero } from "@/components/academy/AcademyFrontHero";

const inputClass =
  "min-w-0 w-full rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-base text-[var(--mikke-text)] outline-none focus:border-[var(--mikke-accent)] sm:text-sm";
const labelClass = "mb-1 block text-sm font-bold text-[var(--mikke-text)]";

function LegacyFrontContent() {
  const { profile } = useAuth();
  const academy2 = useAcademy2Headquarters();
  const identity = `${profile.user_id}:${academy2?.id ?? getAcademyRouteContext()?.academyId ?? "legacy"}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const basicEditable = !academy2 || academy2.role === "administrator";
  const [origin, setOrigin] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [editingArea, setEditingArea] = useState<"body" | "hero">("body");
  const scopedId=getAcademyRouteContext()?.academyId??null;
  const adapter=useRef<ReturnType<typeof getMusubiLegacyPaidAdapter>>(null);
  const [hq, setHq] = useState<HeadquartersFront | null>(null);
  const [courses, setCourses] = useState<Pick<AcademyCourse,"id"|"name"|"code">[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const revision = useRef(0);

  useEffect(() => setOrigin(window.location.origin), []);

  const [form, setForm] = useState({
    name: "",
    tagline: "",
    front_message: "",
    hero_image_url: "",
    contact_email: ""
  });
  // Wave F (AC-F3): 既存hqデータはfront_blocks列が無いため undefined→[] フォールバック必須。
  const [design, setDesign] = useState<AcademyFrontDesign>(defaultFrontDesign);
  const [blocks, setBlocks] = useState<AcademyLpBlock[]>([]);

  useEffect(() => {
    let active=true;
    setLoading(true);
    setHq(null); setCourses([]); setSaveError(""); setSaved(false); setSaving(false);
    async function load() {
      if (academy2 && scopedId !== academy2.id) throw new Error("この本部のページを確認できませんでした。");
      adapter.current=academy2 ? null : getMusubiLegacyPaidAdapter(profile.user_id,scopedId);
      const foundHq = academy2 ? await getHeadquartersFront(academy2.id) : adapter.current ? await adapter.current.read() : await getOwnedHeadquarters(profile.user_id);
      if(!active)return;
      setHq(foundHq);
      if (foundHq) {
        setForm({
          name: foundHq.name,
          tagline: foundHq.tagline ?? "",
          front_message: foundHq.front_message ?? "",
          hero_image_url: foundHq.hero_image_url ?? "",
          contact_email: foundHq.contact_email ?? ""
        });
        const document = readFrontDocument(foundHq.front_blocks ?? []);
        setBlocks(document.blocks);
        setDesign(document.design);
        const loadedCourses=await (academy2 ? listAcademy2Courses(foundHq.id) : listCourses(foundHq.id));
        if(active)setCourses(loadedCourses);
      }
      if(active)setLoading(false);
    }
    void load().catch(() => {
      if(!active)return;
      setSaveError("ホームページを読み込めませんでした。ページを再読み込みしてください。");
      setLoading(false);
    });
    return()=>{active=false;};
  }, [profile.user_id,scopedId,academy2?.id]);

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
    if (!hq || (scopedId && hq.id!==scopedId) || (academy2 && hq.id!==academy2.id)) return;
    const savingIdentity = identity;
    const savingRevision = revision.current;
    setSaving(true);
    setSaveError("");
    try {
      const patch = {
        name: form.name.trim() || hq.name,
        tagline: form.tagline || null,
        front_message: form.front_message || null,
        hero_image_url: form.hero_image_url || null,
        contact_email: form.contact_email || null,
        front_blocks: writeFrontDocument(blocks, design)
      };
      const savedHq = academy2 ? await saveHeadquartersFront(hq.id, hq.updated_at, patch) : await (adapter.current ? adapter.current.saveFront.bind(adapter.current) : (input:Parameters<typeof updateHeadquarters>[1])=>updateHeadquarters(hq.id,input))(patch);
      if(currentIdentity.current !== savingIdentity)return;
      if(savedHq)setHq(savedHq as HeadquartersFront);
      setSaved(revision.current === savingRevision);
    } catch (error) {
      if(currentIdentity.current !== savingIdentity)return;
      setSaveError(error instanceof Error ? error.message : "保存できませんでした。入力内容は残っています。時間をおいてもう一度保存してください。");
    } finally {
      if(currentIdentity.current === savingIdentity)setSaving(false);
    }
  }

  if (loading) return <p className="py-16 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq) return <p role={saveError ? "alert" : undefined} className="py-16 text-center text-sm text-[var(--mikke-muted)]">{saveError || "先に本部を作成してください。"}</p>;

  const homepagePath = `/academy/site/${encodeURIComponent(hq.handle)}`;
  const homepageUrl = origin ? `${origin}${homepagePath}` : "";

  async function copyHomepageUrl() {
    if (!homepageUrl) return;
    try {
      await navigator.clipboard.writeText(homepageUrl);
      setCopyStatus("URLをコピーしました");
    } catch {
      setCopyStatus("コピーできませんでした。URLを選択してコピーしてください。");
    }
  }

  return (
    <div className="min-w-0 w-full space-y-4">
      {academy2&&<CreationReturnLink headquartersId={academy2.id} canLeave={()=>!saving&&(saved||revision.current===0||window.confirm("未保存の内容があります。作成画面へ戻りますか？"))}/> }

      {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
      <section className="space-y-2 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5">
        <p className="text-sm font-bold leading-6 text-[var(--mikke-text)]">本部全体を紹介するホームページです。各講座の申込ページとは別です。</p>
        <label htmlFor="academy-homepage-url" className="block text-sm font-bold text-[var(--mikke-text)]">ホームページのURL</label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="academy-homepage-url"
            readOnly
            value={homepageUrl}
            onFocus={(event) => event.currentTarget.select()}
            className={`${inputClass} sm:flex-1`}
            aria-label="ホームページのURL"
          />
          <button
            type="button"
            onClick={() => void copyHomepageUrl()}
            disabled={!homepageUrl}
            className="min-h-10 rounded-xl border border-[var(--mikke-line)] bg-white px-4 text-sm font-bold text-[var(--mikke-accent)] disabled:opacity-50"
          >
            URLをコピー
          </button>
          <Link
            href={homepagePath}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-[var(--mikke-line)] bg-white px-4 text-sm font-bold text-[var(--mikke-accent)]"
          >
            <ExternalLink size={16} /> 保存済みのページを見る
          </Link>
        </div>
        <p role="status" aria-live="polite" className="min-h-5 text-xs text-[var(--mikke-muted)]">{copyStatus}</p>
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="ホームページの編集場所">
        <button type="button" aria-current={editingArea === "body" ? "page" : undefined} onClick={() => setEditingArea("body")} className={`min-h-11 rounded-xl px-5 text-sm font-bold ${editingArea === "body" ? "bg-[#3f4eb5] text-white" : "border border-[var(--mikke-line)] bg-white"}`}>ページ全体を編集</button>
        <button type="button" aria-current={editingArea === "hero" ? "page" : undefined} onClick={() => setEditingArea("hero")} className={`min-h-11 rounded-xl px-5 text-sm font-bold ${editingArea === "hero" ? "bg-[#3f4eb5] text-white" : "border border-[var(--mikke-line)] bg-white"}`}>ヒーローを編集</button>
      </nav>

      {editingArea === "hero" && <section className="space-y-5 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-6">
        <div><h2 className="text-xl font-bold">ヒーローを編集</h2><p className="mt-1 text-sm text-[var(--mikke-muted)]">ページの最初に表示される部分です。</p></div>
        <AcademyFrontDesignEditor design={design} onChange={next => { revision.current += 1; setDesign(next); setSaved(false); }} title={form.tagline} message={form.front_message} imageUrl={form.hero_image_url} />
        <div>
          <label className={labelClass}>アカデミー名</label>
          <input className={inputClass} value={form.name} disabled={!basicEditable} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>キャッチコピー</label>
          <input
            className={inputClass}
            value={form.tagline}
            disabled={!basicEditable}
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
        {!academy2 && <div>
          <label className={labelClass}>お問い合わせメール</label>
          <input className={inputClass} value={form.contact_email} disabled={!basicEditable} onChange={(e) => set("contact_email", e.target.value)} />
        </div>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setEditingArea("body")} className="min-h-11 rounded-xl border border-[var(--mikke-line)] px-4 text-sm font-bold">ページ全体を見る</button>
        </div>
      </section>}

      {editingArea === "body" && <section className="space-y-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5">
        <h2 className="text-xl font-bold">ホームページ</h2>
        <button type="button" onClick={() => setEditingArea("hero")} className="min-h-11 rounded-xl border border-[var(--mikke-line)] bg-white px-4 text-sm font-bold">ヒーローを編集</button>
        <AcademyLpEditor previewMaxWidth={frontMaxWidth(design)} blocks={blocks} onChange={handleBlocksChange} title={form.name} pageHeader={<div className="border-b border-[var(--mikke-line)]"><AcademyFrontHero design={design} title={form.tagline || "わたしらしい学びで、誰かの未来を照らす。"} message={form.front_message || `${form.name}の講座やワークショップをご紹介します。`} imageUrl={form.hero_image_url} applicationHref={null} coursesHref={null} /></div>} />
      </section>}

      <div className="flex items-center gap-3 rounded-2xl border border-[var(--mikke-line)] bg-white p-4">
        <button type="button" onClick={save} disabled={saving} className="min-h-11 rounded-xl bg-[var(--mikke-accent)] px-5 text-sm font-bold text-white disabled:opacity-60">{saving ? "保存中…" : "ホームページを保存"}</button>
        {saved ? <span className="text-sm font-bold text-[var(--mikke-success)]">保存しました</span> : null}
      </div>

      <section className="rounded-2xl border border-[var(--mikke-line)] bg-white p-4 md:p-5">
        <p className="text-sm font-bold text-[var(--mikke-text)]">講座ページ</p>
        <p className="mt-1 text-sm leading-6 text-[var(--mikke-muted)]">講座情報を編集できます。お客様向けの紹介と申込受付は「サービス」で作成・公開します。</p>
        <ul className="mt-3 space-y-2">
          {courses.map((c) => (
            <li key={c.id} className="flex min-w-0 flex-col items-stretch gap-2 rounded-xl border border-[var(--mikke-line)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--mikke-text)]">
                  {academy2 ? c.name : academyCourseLabel(c)}
                </p>
              </div>
              <Link
                href={academy2 ? toAcademyContextHref(`/academy/courses/${c.id}`, academy2.id, "manage") : `/academy/courses/${c.id}`}
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

function FrontContent(){const headquarters=useAcademy2Headquarters();return headquarters?<HeadquartersHomepageEditor key={headquarters.id} headquartersId={headquarters.id}/>:<LegacyFrontContent/>;}

export default function FrontEditPage() {
  return (
    <HonbuShell title="ホームページ編集">
      <FrontContent />
    </HonbuShell>
  );
}
