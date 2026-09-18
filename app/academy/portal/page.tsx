"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { KoushiShell } from "@/components/academy/AcademyShell";
import { AcademyPersonalHome } from "@/components/academy/AcademyPersonalHome";
import { getCoursesByIds, getMyInstructorRecords } from "@/lib/academy/instructor-portal";
import { listMyLearnerApplications } from "@/lib/academy/learner-portal";
import { getAcademyRouteContext } from "@/lib/academy/access-context";
import type { AcademyApplication, AcademyCourse, AcademyInstructor } from "@/types/database";

function PortalDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get("view") ?? params.get("sample");
  const [data, setData] = useState<{ records: AcademyInstructor[]; applications: AcademyApplication[]; courses: Record<string, AcademyCourse> } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setData(null); setError(false);
    async function load() {
      try {
        const academyId = getAcademyRouteContext()?.academyId;
        const [records, applications] = await Promise.all([getMyInstructorRecords(profile.user_id, academyId), listMyLearnerApplications(profile.user_id, academyId)]);
        const ids = [...new Set([...records.map(record => record.course_id), ...applications.map(application => application.course_id)])];
        const courses = await getCoursesByIds(ids);
        if (active) setData({ records, applications, courses: Object.fromEntries(courses.map(course => [course.id, course])) });
      } catch { if (active) setError(true); }
    }
    void load();
    return () => { active = false; };
  }, [profile.user_id, pathname]);
  if (error) return <div role="alert"><p>マイページを読み込めませんでした。</p><button type="button" className="my-3 min-h-11 rounded-lg border px-4" onClick={() => window.location.reload()}>再読み込み</button></div>;
  if (!data) return <p className="py-12 text-center text-sm">読み込み中…</p>;
  const canSwitch = data.records.length > 0 && data.applications.length > 0;
  const view = requested === "instructor" && data.records.length > 0 ? "instructor" : data.applications.length > 0 ? "learner" : data.records.length > 0 ? "instructor" : "learner";
  return <AcademyPersonalHome name={profile.display_name} view={view} records={data.records} learnerApps={data.applications} courses={data.courses} canSwitch={canSwitch} onSwitch={next => { const query = new URLSearchParams(params.toString()); query.set("view", next); query.delete("sample"); router.replace(`${pathname}?${query.toString()}`); }} />;
}
export default function PortalPage() { return <KoushiShell title="マイページ"><PortalIdentity /></KoushiShell>; }
function PortalIdentity() { const { profile } = useAuth(); const pathname = usePathname(); return <PortalDashboard key={`${profile.user_id}:${pathname}`} />; }
