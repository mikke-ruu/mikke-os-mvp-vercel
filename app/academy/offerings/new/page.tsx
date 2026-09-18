"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { OfferingEditor } from "@/components/academy/OfferingEditor";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { listCourses } from "@/lib/academy/courses";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
import { createOffering, updateOffering, offeringError } from "@/lib/academy/offerings";
import type { AcademyCourse } from "@/types/database";

function Content() {
  const { profile } = useAuth();
  const router = useRouter();
  const [headquartersId, setHeadquartersId] = useState("");
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const createdId = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setHeadquartersId(""); createdId.current = null;
    (async () => { const hq = await getOwnedHeadquarters(profile.user_id); if (!hq) throw new Error("管理する本部が見つかりません。"); const found = await listCourses(hq.id); if (active) { setHeadquartersId(hq.id); setCourses(found); } })().catch(cause => { if (active) setError(offeringError(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile.user_id]);
  if (loading) return <p className="py-8 text-sm">読み込み中…</p>;
  if (error) return <p role="alert">{error}</p>;
  return <OfferingEditor key={`${profile.user_id}:${headquartersId}`} courses={courses} onSave={async input => {
    const result = createdId.current ? await updateOffering(headquartersId, createdId.current, input) : await createOffering(headquartersId, profile.user_id, input);
    createdId.current = result.id;
    router.replace(toCurrentAcademyContextHref(`/academy/offerings/${result.id}`));
    return result;
  }} />;
}
export default function Page() { return <HonbuShell title="募集をつくる"><Content /></HonbuShell>; }
