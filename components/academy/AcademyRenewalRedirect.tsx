"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";
export function AcademyRenewalRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => { router.replace(toCurrentAcademyContextHref(to)); }, [router, to]);
  return <p className="p-6 text-sm">新しい画面を開いています…</p>;
}
