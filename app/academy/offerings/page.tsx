"use client";
import { useEffect, useState } from "react";
import { AcademyCatalogList } from "@/components/academy/AcademyCatalogList";
import { listCourses } from "@/lib/academy/courses";
import type { AcademyCourse } from "@/types/database";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { listOfferings, offeringError, type AcademyOffering } from "@/lib/academy/offerings";
import { offeringUsage } from "@/lib/academy/instructor-offerings";

function Content() {
  const { profile } = useAuth();
  const [offerings, setOfferings] = useState<AcademyOffering[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasHeadquarters, setHasHeadquarters] = useState(false);
  const [retry, setRetry] = useState(0);
  const [courses,setCourses]=useState<AcademyCourse[]>([]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setOfferings([]); setHasHeadquarters(false);
    (async () => {
      const hq = await getOwnedHeadquarters(profile.user_id);
      if (!active) return;
      if (!hq) { setHasHeadquarters(false); return; }
      setHasHeadquarters(true);
      const [found, counts, foundCourses] = await Promise.all([listOfferings(hq.id), offeringUsage(hq.id), listCourses(hq.id)]);
      if (active) { setOfferings(found); setUsage(counts); setCourses(foundCourses); }
    })().catch(cause => { if (active) setError(offeringError(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile.user_id, retry]);
  if (loading) return <p className="py-8 text-sm">募集を読み込み中…</p>;
  if (error) return <div role="alert" className="space-y-3"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 rounded-lg border px-4">再読み込み</button></div>;
  if (!hasHeadquarters) return <p>管理する本部が見つかりません。</p>;
  return <AcademyCatalogList kind="offering" createHref={toCurrentAcademyContextHref("/academy/offerings/new")} filters={[{value:"published",label:"公開中"},{value:"draft",label:"下書き"},{value:"archived",label:"募集終了"}]} items={offerings.map(offering=>({
    id:offering.id,title:offering.title,category:offering.kind,filter:offering.status,
    status:({draft:"下書き",published:"公開中",archived:"募集終了・保管中"} as const)[offering.status],
    summary:`${offering.purchase_mode==="staged"?"講座ごとにお支払い · ":""}¥${Number(offering.price).toLocaleString("ja-JP")} · ${offering.course_ids.map(id=>courses.find(course=>course.id===id)?.name??"講座情報を確認").join("・")}${usage[offering.id]?` · 講師${usage[offering.id]}名が利用中`:""}`,
    editHref:toCurrentAcademyContextHref(`/academy/offerings/${offering.id}`),
    duplicateHref:toCurrentAcademyContextHref(`/academy/offerings/new?duplicate=${offering.id}`)
  }))}/>;
}
export default function Page() { return <HonbuShell title="募集"><Content /></HonbuShell>; }
