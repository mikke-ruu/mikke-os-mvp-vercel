"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { getOwnedHeadquarters } from "@/lib/academy/headquarters";
import { createCourse } from "@/lib/academy/courses";
import type { AcademyHeadquarters } from "@/types/database";
import { CourseForm } from "../CourseForm";

function NewCourseContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [hq, setHq] = useState<AcademyHeadquarters | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOwnedHeadquarters(profile.user_id).then((found) => {
      setHq(found);
      setLoading(false);
    });
  }, [profile.user_id]);

  if (loading) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">読み込み中…</p>;
  if (!hq) return <p className="py-10 text-center text-sm text-[var(--mikke-muted)]">先に本部を作成してください。</p>;

  return (
    <CourseForm
      submitLabel="講座を作成する"
      onSubmit={async (input) => {
        await createCourse(profile, hq.id, input);
        router.push("/academy/courses");
      }}
    />
  );
}

export default function NewCoursePage() {
  return (
    <HonbuShell title="講座を作成">
      <div className="mx-auto max-w-2xl">
        <NewCourseContent />
      </div>
    </HonbuShell>
  );
}
