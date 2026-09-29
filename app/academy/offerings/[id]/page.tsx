"use client";
import { Suspense, use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { OfferingEditor } from "@/components/academy/OfferingEditor";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { listCourses } from "@/lib/academy/courses";
import { getOffering, updateOffering, archiveOffering, offeringError, type AcademyOffering } from "@/lib/academy/offerings";
import type { AcademyCourse } from "@/types/database";
import { useAcademy2Headquarters } from "@/components/academy2/HeadquartersBoundary";
import { SalesPlanDraftEditor } from "@/components/academy2/SalesPlanDraftEditor";
import { SalesPlanStandardPreview } from "@/components/academy2/SalesPlanStandardPreview";
import { SalesPlanPageEditor } from "@/components/academy2/SalesPlanPageEditor";
import { getSalesPlanDraft, type SalesPlanDraft } from "@/lib/academy2/sales-plan-drafts";
import { listAcademy2Courses, type Academy2Course } from "@/lib/academy2/courses";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";

function Content({ id }: { id: string }) {
  const { profile } = useAuth();
  const [offering, setOffering] = useState<AcademyOffering | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setOffering(null);
    (async () => { const hq = await getOwnedHeadquarters(profile.user_id); if (!hq) throw new Error("管理する本部が見つかりません。"); const [found, list] = await Promise.all([getOffering(hq.id, id), listCourses(hq.id)]); if (!found) throw new Error("サービスが見つからないか、表示する権限がありません。"); if (active) { setOffering(found); setCourses(list); } })().catch(cause => { if (active) setError(offeringError(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile.user_id, id]);
  if (loading) return <p className="py-8 text-sm">読み込み中…</p>;
  if (error || !offering) return <p role="alert">{error || "サービスが見つかりません。"}</p>;
  return <OfferingEditor key={`${profile.user_id}:${offering.id}`} initial={offering} courses={courses} onRefreshCourses={async () => { const list = await listCourses(offering.headquarters_id); setCourses(list); }} onSave={async input => { const result = await updateOffering(offering.headquarters_id, offering.id, input); setOffering(result); return result; }} onArchive={async () => { const result = await archiveOffering(offering.headquarters_id, offering.id); setOffering(result); return result; }} />;
}
function EditorIdentity({ id }: { id: string }) {
  const context = useAcademy2Headquarters();
  const { user } = useAuth();
  const router = useRouter();
  const view = useSearchParams().get("preview");
  const preview = view === "standard" || view === "builder" || view === "template";
  const [page, setPage] = useState<{ draft: SalesPlanDraft; courses: Academy2Course[] } | null>(null);
  const [previewError, setPreviewError] = useState("");
  useEffect(() => {
    let live = true;
    setPage(null); setPreviewError("");
    if (context && preview) Promise.all([getSalesPlanDraft(context.id, id), listAcademy2Courses(context.id)])
      .then(([draft, courses]) => { if (live) setPage({ draft, courses }); })
      .catch(cause => { if (live) setPreviewError(cause instanceof Error ? cause.message : "販売ページを読み込めませんでした。"); });
    return () => { live = false; };
  }, [context?.id, id, preview, view]);
  if (!context) return <Content key={id} id={id} />;
  if (preview) return previewError ? <div role="alert"><p>{previewError}</p><a href={toCurrentAcademyContextHref(`/academy/offerings/${id}`)}>販売プランへ戻る</a></div> : page ? view !== "standard" ? <SalesPlanPageEditor initialMode={view === "template" ? "template" : "builder"} key={`${id}:${view}`} draft={page.draft} courses={page.courses} onBack={() => router.replace(toCurrentAcademyContextHref(`/academy/offerings/${id}`))} onPreview={() => router.replace(toCurrentAcademyContextHref(`/academy/offerings/${id}?preview=standard`))} /> : <SalesPlanStandardPreview onMode={mode => router.replace(toCurrentAcademyContextHref(`/academy/offerings/${id}?preview=${mode}`))} draft={page.draft} courses={page.courses} onBack={() => router.replace(toCurrentAcademyContextHref(`/academy/offerings/${id}`))} /> : <p role="status">販売ページを読み込み中…</p>;
  return <SalesPlanDraftEditor key={`${user.id}:${context.id}:${id}`} headquartersId={context.id} draftId={id}
    onPageAction={(action, draft) => { router.replace(toCurrentAcademyContextHref(`/academy/offerings/${draft.id}?preview=${action}`)); }} />;
}
export default function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <HonbuShell title="販売プランを編集"><Suspense fallback={<p>読み込み中…</p>}><EditorIdentity id={id} /></Suspense></HonbuShell>; }
