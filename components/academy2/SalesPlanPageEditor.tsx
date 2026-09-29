"use client";

import { useEffect, useRef, useState } from "react";
import type { SalesPlanDraft } from "@/lib/academy2/sales-plan-drafts";
import type { Academy2Course } from "@/lib/academy2/courses";
import { getSalesPage, saveSalesPage, type SalesPageDraft } from "@/lib/academy2/sales-pages";
import { sectionTemplate } from "@/components/mikkeos/page-builder/lp-canvas";
import builderStyles from "./sales-page-builder.module.css";
import { LpCanvas } from "@/components/mikkeos/page-builder/LpCanvas";
import { LpContent, LpDesignFields } from "@/components/mikkeos/page-builder/LpDesign";
import { LpButtonFields } from "@/components/mikkeos/page-builder/LpButtonFields";
import { LpGalleryFields } from "@/components/mikkeos/page-builder/LpGalleryFields";
import { LpMediaFields } from "@/components/mikkeos/page-builder/LpMediaFields";
import { LpRichWriting } from "@/components/mikkeos/page-builder/LpRichWriting";
import { MikkeBlockFields, type ContentImagePickerProps } from "@/components/mikkeos/content/MikkeBlockFields";
import { AcademyImageFields } from "@/components/academy/AcademyImageFields";
import { AcademyImageUploader } from "@/components/academy/AcademyImageUploader";
import { AcademyCourseCard } from "@/components/academy/AcademyCourseCard";
import { AcademyLpRenderer } from "@/components/academy/AcademyLpRenderer";
import type { LpBlock } from "@/components/mikkeos/page-builder/lp-design";
import { createAcademyPageTemplateRegistry } from "@/lib/academy2/page-templates";
import { salesPageTemplateChoices } from "@/lib/academy2/reviewed-page-templates";
import { standardSalesPageBlocks } from "@/lib/academy2/standard-sales-page";
import pageStyles from "./sales-page-workspace.module.css";
import styles from "@/components/academy/offering-editor.module.css";

function ImagePicker({ currentUrl, onSelect }: ContentImagePickerProps) {
  return <div><AcademyImageUploader compact currentUrl={currentUrl} onUploaded={publicUrl => onSelect({ publicUrl })} />{currentUrl && <button type="button" onClick={() => onSelect({ publicUrl: "" })}>画像を外す</button>}</div>;
}
function LinkEditor({ block, onChange }: { block: LpBlock; onChange: (block: LpBlock) => void }) {
  return <div><label>リンク先URL<input className={styles.field} type="url" value={block.url ?? ""} onChange={event => onChange({ ...block, url: event.target.value })} /></label><label>表示名<input className={styles.field} value={block.title ?? ""} onChange={event => onChange({ ...block, title: event.target.value })} /></label></div>;
}
function renderBlocks(blocks: LpBlock[], courses: Academy2Course[]) {
  return blocks.map(block => {
    if (block.lp?.reference?.kind !== "academy-course") return <AcademyLpRenderer key={block.id} blocks={[block]} />;
    const course = courses.find(item => item.id === block.lp?.reference?.id);
    return course ? <AcademyCourseCard key={block.id} course={{ ...course, price: 0 }} hidePrice imageSide={block.lp.reference.imageSide} /> : <p key={block.id}>対象の講座を確認してください。</p>;
  });
}
/** The same responsive section renderer used on the existing public offering page. */
export function SalesPlanPageContent({ blocks, courses }: { blocks: LpBlock[]; courses: Academy2Course[] }) {
  return <LpContent minimumFontSize={9} standaloneButtons blocks={blocks} render={items => renderBlocks(items, courses)} />;
}
export function SalesPlanPageEditor({ draft, courses, onBack, onPreview, initialMode = "builder" }: { draft: SalesPlanDraft; courses: Academy2Course[]; onBack: () => void; onPreview: () => void; initialMode?: "builder" | "template" }) {
  const [mode, setMode] = useState(initialMode);
  const [page, setPage] = useState<SalesPageDraft | null>(null);
  const [blocks, setBlocks] = useState<LpBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  const selectedIds = draft.configuration.course_ids.length ? draft.configuration.course_ids : draft.course_snapshot.map(course => course.course_id);
  const selected = selectedIds.flatMap(id => courses.filter(course => course.id === id));
  function useTemplate(templateId: string) {
    try {
      const firstTemplate = page?.revision === 0 && !dirty;
      const prepared = createAcademyPageTemplateRegistry().prepare({ templateId, version: 1, target: "sales_page", headquartersId: draft.headquarters_id, salesPlan: draft, existingBlocks: firstTemplate ? [] : blocks, mode: firstTemplate ? "new_page" : "append" });
      if (firstTemplate) prepared.blocks.push(...blocks.filter(block => block.lp?.reference?.kind === 'academy-course'));
      setBlocks(prepared.blocks); setDirty(true); setError(""); setMode("builder");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "テンプレートを読み込めませんでした。"); }
  }
  useEffect(() => {
    let live = true; setLoading(true); setError("");
    getSalesPage(draft.headquarters_id, draft.id).then(row => { if (live) { setPage(row); setBlocks(row.revision === 0 ? standardSalesPageBlocks(draft,courses) : row.blocks); setDirty(false); } })
      .catch(cause => { if (live) setError(cause instanceof Error ? cause.message : "販売ページを読み込めませんでした。"); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [draft.headquarters_id, draft.id, retry]);
  useEffect(() => { const leave = (event: BeforeUnloadEvent) => { if (dirty || saving) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", leave); return () => window.removeEventListener("beforeunload", leave); }, [dirty, saving]);
  async function save() {
    if (!page || lock.current) return false;
    lock.current = true; setSaving(true); setError("");
    try { const row = await saveSalesPage(draft.headquarters_id, draft.id, page.revision, draft.revision, blocks); setPage(row); setBlocks(row.blocks); setDirty(false); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "保存できませんでした。入力内容は残っています。"); return false; }
    finally { lock.current = false; setSaving(false); }
  }
  async function previewSaved() { if ((!dirty && page && page.revision > 0) || await save()) onPreview(); }
  const newBlock = (type:LpBlock['type'], title:string, text = ''):LpBlock => ({id:crypto.randomUUID(),type,title,text,lp:{desktop:{padding:24},mobile:{padding:16}}});
  const sectionLibrary = [
    {label:'HERO',create:()=>({...standardSalesPageBlocks(draft,courses)[0],title:'HERO'})},
    {label:'文章',create:()=>newBlock('paragraph','文章','文章を入力してください。')},
    {label:'画像',create:()=>newBlock('image','画像')},
    {label:'講座一覧',create:():LpBlock=>({id:crypto.randomUUID(),type:'paragraph',title:'講座一覧',lp:{desktop:{padding:24,gap:16},mobile:{padding:16},children:selected.filter(course=>course.show_introduction!==false).map(course=>({id:crypto.randomUUID(),type:'paragraph',title:course.name,lp:{reference:{kind:'academy-course',id:course.id,imageSide:'left'}}}))}})},
    {label:'料金を確認',action:()=>void previewSaved()},
    {label:'開催日程を確認',action:()=>void previewSaved()},
    {label:'講師紹介',create:()=>newBlock('paragraph','講師紹介','講師の経歴や、講座で大切にしていることを紹介してください。')},
    {label:'FAQ',create:()=>sectionTemplate('よくある質問')},
    {label:'申込ボタン',create:():LpBlock=>({id:crypto.randomUUID(),type:'cta',buttonLabel:'お申込みへ',url:'#apply'})},
    {label:'区切り',create:()=>newBlock('divider','区切り')},
  ];
  if (loading) return <p role="status">販売ページを読み込み中…</p>;
  if (!page) return <div role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>再読み込み</button></div>;
  return <div className={pageStyles.workspace}>
    <button type="button" className={pageStyles.back} disabled={saving} onClick={() => { if (!dirty || window.confirm("未保存の内容があります。販売プランへ戻りますか？")) onBack(); }}>← 販売プラン「{draft.configuration.title}」へ</button>
    <header className={pageStyles.title}><h1>販売ページ</h1><p>文章・写真・配置を編集して、ご自身の講座を紹介できます。</p></header>
    <p className="my-3 text-xs">ページの保存だけでは募集は公開されません。金額・申込条件は販売プランの設定を使用します。</p>
    <nav className={pageStyles.tabs} aria-label="販売ページの作成方法">
      <button type="button" disabled={saving} onClick={async () => { if ((!dirty && page.revision > 0) || await save()) onPreview(); }}>標準LP</button>
      <button type="button" aria-current={mode === "template" ? "page" : undefined} onClick={() => setMode("template")}>テンプレート</button>
      <button type="button" aria-current={mode === "builder" ? "page" : undefined} onClick={() => setMode("builder")}>ビルダー</button>
    </nav>
    {mode === "template" && <section className={pageStyles.templates} aria-label="販売ページテンプレート"><p>見本を選び、ご自身の講座に合わせて文章や写真を変更できます。既存の内容は残し、その後ろに見本を追加します。</p><div className={pageStyles.grid}>{salesPageTemplateChoices.map(choice => <article className={pageStyles.card} key={choice.id}><div className={pageStyles.thumbnail} style={{ background: choice.background }}>{choice.heading}</div><div className={pageStyles.cardBody}><h2>{choice.label}</h2><p>{choice.description}</p><button type="button" disabled={saving} onClick={() => useTemplate(choice.id)}>このテンプレートを使う</button></div></article>)}</div></section>}
    {page.needs_rebase && <p role="status" className="my-3 text-sm">販売プランが更新されています。ページ内容を確認して保存してください。</p>}
    <fieldset className={builderStyles.fieldset} disabled={saving} inert={saving} hidden={mode !== "builder"}>
      <LpCanvas presentation={{className:builderStyles.builder,minimumFontSize:9,stackBreakpoint:900,inlineInspector:true,selectFirst:true,sectionLibrary,
          toolbarStart:<div><button type="button" onClick={()=>{if(window.confirm('編集中の内容を標準ページに戻しますか？保存済みの内容は、次に保存するまで変わりません。')){setBlocks(standardSalesPageBlocks(draft,courses));setDirty(true);setError('');}}}>標準ページを元に戻す</button><button type="button" onClick={()=>setMode('template')}>テンプレート変更</button></div>,
          toolbarEnd:<button type="button" className={builderStyles.save} onClick={()=>void save()}>{saving?'保存中…':'保存'}</button>,
          sidebarFooter:<div className={builderStyles.linked}><p>料金・開催日程は販売プラン・開催の保存内容を表示します。</p></div>,
          inspectorNote:<p className={builderStyles.note}>配置・写真・文章を編集し、セクションを追加・削除できます。料金・開催日程・申込条件は販売プラン・開催と連動します。</p>
        }} hidePageTitle allowMediaParts title={draft.configuration.title} pageLabel="販売ページ" blocks={blocks} onChange={next => { if (lock.current) return; setBlocks(next); setDirty(true); setError(""); }}
        extraTemplates={selected.map(course => ({ label: course.name, description: "講座カード", create: (): LpBlock => ({ id: crypto.randomUUID(), type: "paragraph", title: course.name, lp: { reference: { kind: "academy-course", id: course.id, imageSide: "left" }, desktop: { padding: 24 }, mobile: { padding: 16 } } }) }))}
        renderContent={items => <>{renderBlocks(items, selected)}</>}
        renderFields={(block, update, tab) => {
          if (block.type === "cta") return <LpButtonFields block={block} onChange={update} tab={tab} />;
          if (tab === "design") return <>{["image", "gallery", "video"].includes(block.type) && <LpMediaFields block={block} onChange={update} />}<LpDesignFields minimumFontSize={9} expanded block={block} onChange={update} imagePicker={<ImagePicker currentUrl={block.lp?.backgroundImage} onSelect={asset => update({ ...block, lp: { ...block.lp, backgroundImage: asset.publicUrl } })} />} /></>;
          if (block.lp?.reference?.kind === "academy-course") return <label>PCの画像位置<select value={block.lp.reference.imageSide ?? "left"} onChange={event => update({ ...block, lp: { ...block.lp, reference: { ...block.lp!.reference!, imageSide: event.target.value === "right" ? "right" : "left" } } })}><option value="left">左</option><option value="right">右</option></select><p>講座情報で保存した内容を表示します。</p></label>;
          if (block.type === "image") return <AcademyImageFields block={block} onChange={update} ImagePicker={ImagePicker} />;
          if (block.type === "gallery") return <LpGalleryFields block={block} onChange={update} ImagePicker={ImagePicker} />;
          if (block.type === "heading" || block.type === "paragraph") return <LpRichWriting compact block={block} onChange={update} />;
          return <MikkeBlockFields block={block} onChange={update} onSplit={() => {}} ImagePicker={ImagePicker} LinkEditor={LinkEditor} />;
        }} />
    </fieldset>
    <div className={styles.saveBar}><button type="button" className={styles.action} style={{ background: "#f75a3b", color: "white" }} disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : "販売ページを保存"}</button><button type="button" className={styles.action} disabled={saving} onClick={async () => { if ((!dirty && page.revision > 0) || await save()) onPreview(); }}>保存してプレビュー</button></div>
    <p role="status" className="my-3 text-xs">{saving ? "保存中…" : dirty ? "未保存の変更があります" : page.revision === 0 ? "標準ページを生成しました。まだ保存されていません。" : "保存しました"}</p>
    {error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
  </div>;
}
