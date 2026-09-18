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
        if (!source) throw new Error("複製する募集が見つかりません。");
        draft = { ...offeringInput(source), title: `${source.title}（コピー）`, status: "draft" };
      } else if (courseId) {
        const course = found.find(item => item.id === courseId);
        if (!course) throw new Error("募集に使う講座が見つかりません。");
        draft = { ...draft, title: course.name, price: Number(course.price), course_ids: [course.id], lp_blocks: [{ id: crypto.randomUUID(), type: "paragraph", title: course.name, lp: { reference: { kind: "academy-course", id: course.id, imageSide: course.feature_settings?.marketing?.imageSide ?? "left" }, desktop: { padding: 24 }, mobile: { padding: 16 } } }] };
      }
      if (active) { setHeadquartersId(hq.id); setCourses(found); setInitialInput(draft); }
    })().catch(cause => { if (active) setError(offeringError(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile.user_id, courseId, duplicateId]);
  if (loading) return <p className="py-8 text-sm">読み込み中…</p>;
  if (error) return <p role="alert">{error}</p>;
  return <OfferingEditor key={`${profile.user_id}:${headquartersId}:${courseId ?? ""}:${duplicateId ?? ""}`} initialInput={initialInput} courses={courses} onSave={async input => {
    const result = createdId.current ? await updateOffering(headquartersId, createdId.current, input) : await createOffering(headquartersId, profile.user_id, input);
    createdId.current = result.id;
    router.replace(toCurrentAcademyContextHref(`/academy/offerings/${result.id}`));
    return result;
  }} />;
}
export default function Page() { return <HonbuShell title="募集をつくる"><Suspense fallback={<p>読み込み中…</p>}><Content /></Suspense></HonbuShell>; }
