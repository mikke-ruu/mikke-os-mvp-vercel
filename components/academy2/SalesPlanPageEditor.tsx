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
import { standardSalesPageBlocks, standardCourseCardPrefix,isStandardSalesPageV2,isStandardSalesPageV5,preserveStandardSalesPageFormat } from "@/lib/academy2/standard-sales-page";
import {StandardV5Content} from './StandardSalesPageV5';
import v5Styles from './standard-sales-page-v5.module.css';
import {SalesCourseCard} from './SalesCourseCard';
import pageStyles from "./sales-page-workspace.module.css";
import styles from "@/components/academy/offering-editor.module.css";
import { listAcademy2Events, type Academy2EventSummary } from '@/lib/academy2/operations';
import { defaultSalesPageDisplay, readSalesPageDisplay, salesPageContentBlocks, withSalesPageDisplay, type SalesPageDisplay } from '@/lib/academy2/sales-page-display';
import { SalesPageBottom } from './SalesPageBottom';
import { SalesPlanApplicationPreview } from './SalesPlanApplicationPreview';

function ImagePicker({ currentUrl, onSelect }: ContentImagePickerProps) {
  return <div><AcademyImageUploader compact currentUrl={currentUrl} onUploaded={publicUrl => onSelect({ publicUrl })} />{currentUrl && <button type="button" onClick={() => onSelect({ publicUrl: "" })}>画像を外す</button>}</div>;
}
function LinkEditor({ block, onChange }: { block: LpBlock; onChange: (block: LpBlock) => void }) {
  return <div><label>リンク先URL<input className={styles.field} type="url" value={block.url ?? ""} onChange={event => onChange({ ...block, url: event.target.value })} /></label><label>表示名<input className={styles.field} value={block.title ?? ""} onChange={event => onChange({ ...block, title: event.target.value })} /></label></div>;
}
function renderBlocks(blocks: LpBlock[], courses: Academy2Course[], returnHref?:string, previewHq?:string) {
  return blocks.map(block => {
    if (block.lp?.reference?.kind !== "academy-course") return <AcademyLpRenderer key={block.id} blocks={[block]} />;
    const course = courses.find(item => item.id === block.lp?.reference?.id);
    if(course&&block.id.startsWith(standardCourseCardPrefix))return <SalesCourseCard key={block.id} course={{...course,price:0}} returnHref={returnHref} previewHq={previewHq} imageSide={block.lp.reference.imageSide}/>;
    return course ? <AcademyCourseCard key={block.id} course={{ ...course, price: 0 }} hidePrice imageSide={block.lp.reference.imageSide} /> : <p key={block.id}>対象の講座を確認してください。</p>;
  });
}
/** The same responsive section renderer used on the existing public offering page. */
export function SalesPlanPageContent({ blocks, courses, returnHref, previewHq }: { blocks: LpBlock[]; courses: Academy2Course[]; returnHref?:string;previewHq?:string }) {
  if(isStandardSalesPageV5(blocks))return <StandardV5Content blocks={blocks} courses={courses.map(course=>({...course,price:0}))} returnHref={returnHref} previewHq={previewHq} renderFallback={items=>renderBlocks(items,courses,returnHref,previewHq)}/>;
  return <LpContent honorVisibility minimumFontSize={14} standaloneButtons blocks={salesPageContentBlocks(blocks)} render={items => renderBlocks(items, courses,returnHref,previewHq)} />;
}
import {CreationReturnLink} from './CreationReturnLink';
export function SalesPlanPageEditor({ draft, courses, onBack, onPreview }: { draft: SalesPlanDraft; courses: Academy2Course[]; onBack: () => void; onPreview: () => void; initialMode?: "builder" | "template" }) {
  const [page, setPage] = useState<SalesPageDraft | null>(null);
  const [blocks, setBlocks] = useState<LpBlock[]>([]);
  const [display, setDisplay] = useState<SalesPageDisplay>(defaultSalesPageDisplay);
  const [events, setEvents] = useState<Academy2EventSummary[] | null>(null);
  const [eventsError, setEventsError] = useState('');
  const [formPreview, setFormPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  const selectedIds = draft.configuration.course_ids.length ? draft.configuration.course_ids : draft.course_snapshot.map(course => course.course_id);
  const selected = selectedIds.flatMap(id => courses.filter(course => course.id === id));
  useEffect(() => {
    let live = true; setLoading(true); setError("");
    getSalesPage(draft.headquarters_id, draft.id).then(row => { if (live) { setPage(row); setBlocks(row.revision === 0 ? standardSalesPageBlocks(draft,courses) : salesPageContentBlocks(row.blocks)); setDisplay(readSalesPageDisplay(row.blocks)); setDirty(false); } })
      .catch(cause => { if (live) setError(cause instanceof Error ? cause.message : "販売ページを読み込めませんでした。"); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [draft.headquarters_id, draft.id, retry]);
  useEffect(() => {
    let live = true; setEvents(null); setEventsError('');
    if (draft.configuration.study_style === 'materials_only') return;
    listAcademy2Events(draft.headquarters_id).then(rows => { if (live) setEvents(rows.filter(row => row.sales_plan_id === draft.id)); })
      .catch(() => { if (live) setEventsError('開催日程を読み込めませんでした。'); });
    return () => { live = false; };
  }, [draft.headquarters_id, draft.id, draft.configuration.study_style]);
  useEffect(() => { const leave = (event: BeforeUnloadEvent) => { if (dirty || saving) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", leave); return () => window.removeEventListener("beforeunload", leave); }, [dirty, saving]);
  async function save() {
    if (!page || lock.current) return false;
    lock.current = true; setSaving(true); setError("");
    try { const row = await saveSalesPage(draft.headquarters_id, draft.id, page.revision, draft.revision, withSalesPageDisplay(blocks, display)); setPage(row); setBlocks(salesPageContentBlocks(row.blocks)); setDisplay(readSalesPageDisplay(row.blocks)); setDirty(false); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "保存できませんでした。入力内容は残っています。"); return false; }
    finally { lock.current = false; setSaving(false); }
  }
  function changeDisplay(next: Partial<SalesPageDisplay>) { setDisplay(current => ({...current,...next})); setDirty(true); setError(''); }
  const newBlock = (type:LpBlock['type'], title:string, text = ''):LpBlock => ({id:crypto.randomUUID(),type,title,text,lp:{desktop:{padding:24},mobile:{padding:16}}});
  const sectionLibrary = [
    {label:'HERO',create:()=>({...standardSalesPageBlocks(draft,courses)[0],id:crypto.randomUUID(),title:'HERO'})},
    {label:'文章',create:()=>newBlock('paragraph','文章','文章を入力してください。')},
    {label:'画像',create:()=>newBlock('image','画像')},
    {label:'講座一覧',create:():LpBlock=>({id:crypto.randomUUID(),type:'paragraph',title:'講座一覧',lp:{desktop:{padding:24,gap:16},mobile:{padding:16},children:selected.filter(course=>course.show_introduction!==false).map(course=>({id:crypto.randomUUID(),type:'paragraph',title:course.name,lp:{reference:{kind:'academy-course',id:course.id,imageSide:'left'}}}))}})},
    {label:'料金',action:()=>document.getElementById('sales-page-price')?.scrollIntoView({behavior:'smooth',block:'center'})},
    {label:'開催日程',action:()=>document.getElementById('sales-page-schedule')?.scrollIntoView({behavior:'smooth',block:'center'})},
    {label:'講師紹介',create:()=>newBlock('paragraph','講師紹介','講師の経歴や、講座で大切にしていることを紹介してください。')},
    {label:'FAQ',create:()=>sectionTemplate('よくある質問')},
    {label:'申込ボタン',create:():LpBlock=>({id:crypto.randomUUID(),type:'cta',buttonLabel:'お申込みへ',url:'#apply'})},
    {label:'区切り',create:()=>newBlock('divider','区切り')},
  ];
  if (loading) return <p role="status">販売ページを読み込み中…</p>;
  if (!page) return <div role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>再読み込み</button></div>;
  return <div className={pageStyles.workspace}>
    <CreationReturnLink headquartersId={draft.headquarters_id} canLeave={()=>!saving&&(!dirty||window.confirm("未保存の内容があります。作成画面へ戻りますか？"))}/>
    <button type="button" className={pageStyles.back} disabled={saving} onClick={() => { if (!dirty || window.confirm("未保存の内容があります。販売プランへ戻りますか？")) onBack(); }}>← 販売プラン「{draft.configuration.title}」へ</button>
    <header className={pageStyles.title}><h1>販売ページを編集</h1><p>文章や写真を入れて、講座を紹介します。</p></header>
    <p className="my-3 text-sm">料金・開催日程は下のプレビューで確認できます。見出しや余白もここで調整できます。</p>
    <nav className={pageStyles.tabs} aria-label="販売ページの作成方法">
      <button type="button" disabled={saving} onClick={async () => { if ((!dirty && page.revision > 0) || await save()) onPreview(); }}>プレビュー</button>
      <button type="button" aria-current="page">ビルダー</button>
    </nav>
    {page.needs_rebase && <p role="status" className="my-3 text-sm">販売プランが更新されています。ページ内容を確認して保存してください。</p>}
    <fieldset className={builderStyles.fieldset} disabled={saving} inert={saving}>
      <LpCanvas presentation={{className:`${builderStyles.builder} ${isStandardSalesPageV5(blocks)?builderStyles.v5Builder:''}`,minimumFontSize:14,stackBreakpoint:900,inlineInspector:true,selectFirst:true,showOutline:true,allowVisibility:true,sectionLibrary,
          ...(isStandardSalesPageV5(blocks)?{pageClassName:v5Styles.page,desktopViewportWidth:980,renderPage:(items,context)=><StandardV5Content blocks={items} courses={selected.map(course=>({...course,price:0}))} returnHref={`/academy/h/${draft.headquarters_id}/manage/offerings/${draft.id}?preview=builder`} previewHq={draft.headquarters_id} includeHidden={!context.reading} decorate={context.reading?undefined:context.decorate} renderHeading={block=>!context.reading&&context.isSelected(block)?context.renderContent([block]):undefined} renderFallback={context.renderContent}/>} : {}),
          toolbarStart:<div><button type="button" onClick={()=>{if(window.confirm('編集中の内容を標準ページに戻しますか？保存済みの内容は、次に保存するまで変わりません。')){setBlocks(standardSalesPageBlocks(draft,courses));setDirty(true);setError('');}}}>標準ページに戻す</button></div>,
          toolbarEnd:<button type="button" className={builderStyles.save} onClick={()=>void save()}>{saving?'保存中…':'保存する'}</button>,
          sidebarFooter:isStandardSalesPageV5(blocks)?<p className={builderStyles.note}>受講案内・料金・規約・申込先は、販売プランと開催の保存情報に連動します。</p>:<div className={builderStyles.linked}><p>料金・日程・申込の見せ方</p><label>料金の位置<select value={display.priceAlign} onChange={event=>changeDisplay({priceAlign:event.target.value as SalesPageDisplay['priceAlign']})}><option value="left">左</option><option value="center">中央</option></select></label><label>余白<select value={display.spacing} onChange={event=>changeDisplay({spacing:event.target.value as SalesPageDisplay['spacing']})}><option value="compact">狭い</option><option value="regular">標準</option><option value="spacious">広い</option></select></label><label>背景<select value={display.tone} onChange={event=>changeDisplay({tone:event.target.value as SalesPageDisplay['tone']})}><option value="white">白</option><option value="warm">淡いベージュ</option><option value="soft">淡いグリーン</option></select></label><label>料金の見出し<input value={display.priceHeading} onChange={event=>changeDisplay({priceHeading:event.target.value})}/></label><label>日程の見出し<input value={display.scheduleHeading} onChange={event=>changeDisplay({scheduleHeading:event.target.value})}/></label><label>申込の見出し<input value={display.applicationHeading} onChange={event=>changeDisplay({applicationHeading:event.target.value})}/></label></div>,
          inspectorNote:<p className={builderStyles.note}>下の料金・日程・申込部分もページ内で確認できます。</p>
        }} hidePageTitle allowMediaParts title={draft.configuration.title} pageLabel="販売ページ" blocks={blocks} footer={<SalesPageBottom draft={draft} events={events} eventsError={eventsError} display={display} standard={isStandardSalesPageV2(blocks)} v5={isStandardSalesPageV5(blocks)} onFormPreview={()=>setFormPreview(true)}/>} onChange={next => { if (lock.current) return; setBlocks(preserveStandardSalesPageFormat(blocks,next)); setDirty(true); setError(""); }}
        extraTemplates={selected.map(course => ({ label: course.name, description: "講座カード", create: (): LpBlock => ({ id: crypto.randomUUID(), type: "paragraph", title: course.name, lp: { reference: { kind: "academy-course", id: course.id, imageSide: "left" }, desktop: { padding: 24 }, mobile: { padding: 16 } } }) }))}
        renderContent={items => <>{renderBlocks(items, selected,`/academy/h/${draft.headquarters_id}/manage/offerings/${draft.id}?preview=builder`,draft.headquarters_id)}</>}
        renderFields={(block, update, tab) => {
          if(isStandardSalesPageV5(blocks)&&block.lp?.reference?.kind==='academy-course'&&block.id.startsWith(standardCourseCardPrefix))return <p>講座カードは第5案の配置で表示します。写真と紹介文は講座情報から取得します。</p>;
          if (block.type === "cta") return <LpButtonFields block={block} onChange={update} tab={tab} />;
          if (tab === "design") return <>{["image", "gallery", "video"].includes(block.type) && <LpMediaFields block={block} onChange={update} />}<LpDesignFields minimumFontSize={14} expanded block={block} onChange={update} imagePicker={<ImagePicker currentUrl={block.lp?.backgroundImage} onSelect={asset => update({ ...block, lp: { ...block.lp, backgroundImage: asset.publicUrl } })} />} /></>;
          if (block.lp?.reference?.kind === "academy-course") return <label>PCの画像位置<select value={block.lp.reference.imageSide ?? "left"} onChange={event => update({ ...block, lp: { ...block.lp, reference: { ...block.lp!.reference!, imageSide: event.target.value === "right" ? "right" : "left" } } })}><option value="left">左</option><option value="right">右</option></select><p>講座情報で保存した内容を表示します。</p></label>;
          if (block.type === "image") return <AcademyImageFields block={block} onChange={update} ImagePicker={ImagePicker} />;
          if (block.type === "gallery") return <LpGalleryFields block={block} onChange={update} ImagePicker={ImagePicker} />;
          if (block.type === "heading" || block.type === "paragraph") return <LpRichWriting compact block={block} onChange={update} />;
          return <MikkeBlockFields block={block} onChange={update} onSplit={() => {}} ImagePicker={ImagePicker} LinkEditor={LinkEditor} />;
        }} />
    </fieldset>
    <p role="status" className={builderStyles.status}>{saving ? "保存中…" : dirty ? "未保存の変更があります" : page.revision === 0 ? "標準ページを生成しました。まだ保存されていません。" : "保存しました"}</p>
    {error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
    {formPreview && <SalesPlanApplicationPreview headquartersId={draft.headquarters_id} planId={draft.id} configuration={draft.configuration} fields={draft.configuration.application_form?.fields??[]} onClose={()=>setFormPreview(false)}/>}
  </div>;
}
