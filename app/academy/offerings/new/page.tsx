"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { OfferingEditor } from "@/components/academy/OfferingEditor";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { listCourses } from "@/lib/academy/courses";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { blankOfferingInput, createOffering, getOffering, offeringInput, updateOffering, offeringError, type OfferingInput } from "@/lib/academy/offerings";
import type { AcademyCourse } from "@/types/database";
import { useAcademy2Headquarters } from "@/components/academy2/HeadquartersBoundary";
import { SalesPlanDraftEditor } from "@/components/academy2/SalesPlanDraftEditor";
import {SalesPlanSamples,SalesPlanNewChoices} from "@/components/academy2/SalesPlanDraftCatalog";
import {parseSalesPlanPreset,parseSalesPlanSample} from "@/lib/academy2/sales-plan-presets";
import styles from "@/components/academy2/sales-plan-catalog.module.css";

function Content() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get("courseId");
  const duplicateId = searchParams.get("duplicate");
  const [initialInput, setInitialInput] = useState<OfferingInput>();
  const [headquartersId, setHeadquartersId] = useState("");
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const createdId = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setHeadquartersId(""); createdId.current = null;
    (async () => {
      const hq = await getOwnedHeadquarters(profile.user_id);
      if (!hq) throw new Error("管理する本部が見つかりません。");
      const found = await listCourses(hq.id);
      let draft = blankOfferingInput();
      if (duplicateId) {
        const source = await getOffering(hq.id, duplicateId);
        if (!source) throw new Error("複製するサービスが見つかりません。");
        draft = { ...offeringInput(source), title: `${source.title}（コピー）`, status: "draft" };
      } else if (courseId) {
        const course = found.find(item => item.id === courseId);
        if (!course) throw new Error("サービスに使う講座が見つかりません。");
        draft = { ...draft, title: course.name, price: Number(course.price), course_ids: [course.id], lp_blocks: [{ id: crypto.randomUUID(), type: "paragraph", title: course.name, lp: { reference: { kind: "academy-course", id: course.id, imageSide: course.feature_settings?.marketing?.imageSide ?? "left" }, desktop: { padding: 24 }, mobile: { padding: 16 } } }] };
      }
      if (active) { setHeadquartersId(hq.id); setCourses(found); setInitialInput(draft); }
    })().catch(cause => { if (active) setError(offeringError(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile.user_id, courseId, duplicateId]);
  if (loading) return <p className="py-8 text-sm">読み込み中…</p>;
  if (error) return <p role="alert">{error}</p>;
  return <OfferingEditor key={`${profile.user_id}:${headquartersId}:${courseId ?? ""}:${duplicateId ?? ""}`} initialInput={initialInput} courses={courses} onRefreshCourses={async () => { const list = await listCourses(headquartersId); setCourses(list); }} onSave={async input => {
    const result = createdId.current ? await updateOffering(headquartersId, createdId.current, input) : await createOffering(headquartersId, profile.user_id, input);
    createdId.current = result.id;
    router.replace(toCurrentAcademyContextHref(`/academy/offerings/${result.id}`));
    return result;
  }} />;
}
function EditorIdentity() {
  const context = useAcademy2Headquarters();
  const searchParams = useSearchParams();
  const courseId = searchParams.get("courseId") ?? undefined;
  const preset = parseSalesPlanPreset(searchParams.get("preset"));
  const sample = parseSalesPlanSample(searchParams.get("sample"));
  const { user } = useAuth();
  const router = useRouter();
  if(context && searchParams.get("view")==="samples") return <SalesPlanSamples headquartersId={context.id}/>;
  if(context && !preset && !sample && !courseId) return <main className={styles.wrap}><div className={styles.titlebar}><div className={styles.en}>CHOOSE A SALES PLAN</div><div className={styles.jp}>どんな売り方をしますか？</div></div><div className={styles["modal-body"]}><SalesPlanNewChoices headquartersId={context.id}/></div></main>;
  return context ? <SalesPlanDraftEditor key={`${user.id}:${context.id}:${preset??""}:${sample??""}`} headquartersId={context.id} initialCourseId={sample?undefined:courseId} initialPreset={preset} initialSample={sample}
    onSaved={draft => router.replace(toCurrentAcademyContextHref(`/academy/offerings/${draft.id}`))}
    onPageAction={(action, draft) => { if (action !== "template") router.replace(toCurrentAcademyContextHref(`/academy/offerings/${draft.id}?preview=${action}`)); }} /> : <Content />;
}
export default function Page() { return <HonbuShell title="販売プランをつくる"><Suspense fallback={<p>読み込み中…</p>}><EditorIdentity /></Suspense></HonbuShell>; }
