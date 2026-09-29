"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toCurrentAcademyContextHref } from "@/lib/academy/access-context";

// Preserve the visible HQ context after the /academy/h/... rewrite.
// The destination retains its existing owner checks and order authorization.
export default function KitsPage() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    router.replace(toCurrentAcademyContextHref("/academy/applications?tab=koushi"));
  }, [pathname, router]);
  return <p className="p-6 text-sm">キットの申込管理へ移動しています…</p>;
}
