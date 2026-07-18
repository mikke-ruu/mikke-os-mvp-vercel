"use client";

import { AuthGate } from "@/components/AuthGate";
import { PageSiteEditor } from "@/components/page/PageSiteEditor";

export default function PageSitePage() {
  return (
    <AuthGate>
      <PageSiteEditor />
    </AuthGate>
  );
}
