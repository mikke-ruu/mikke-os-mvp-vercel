"use client";
import { use, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { OfferingEditor } from "@/components/academy/OfferingEditor";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { listCourses } from "@/lib/academy/courses";
import { getOffering, updateOffering, archiveOffering, offeringError, type AcademyOffering } from "@/lib/academy/offerings";
import type { AcademyCourse } from "@/types/database";

function Content({ id }: { id: string }) {
  const { profile } = useAuth();
  const [offering, setOffering] = useState<AcademyOffering | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setOffering(null);
    (async () => { const hq = await getOwnedHeadquarters(profile.user_id); if (!hq) throw new Error("管理する本部が見つかりません。"); const [found, list] = await Promise.all([getOffering(hq.id, id), listCourses(hq.id)]); if (!found) throw new Error("募集が見つからないか、表示する権限がありません。"); if (active) { setOffering(found); setCourses(list); } })().catch(cause => { if (active) setError(offeringError(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile.user_id, id]);
  if (loading) return <p className="py-8 text-sm">読み込み中…</p>;
  if (error || !offering) return <p role="alert">{error || "募集が見つかりません。"}</p>;
  return <OfferingEditor key={`${profile.user_id}:${offering.id}`} initial={offering} courses={courses} onSave={async input => { const result = await updateOffering(offering.headquarters_id, offering.id, input); setOffering(result); return result; }} onArchive={async () => { const result = await archiveOffering(offering.headquarters_id, offering.id); setOffering(result); return result; }} />;
}
export default function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <HonbuShell title="募集を編集"><Content key={id} id={id} /></HonbuShell>; }
