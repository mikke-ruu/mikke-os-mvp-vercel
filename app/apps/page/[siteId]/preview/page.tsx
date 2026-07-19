"use client";

import { AuthGate } from "@/components/AuthGate";
import { PageSitePreview } from "@/components/page/PageSitePreview";

export default function PageSitePreviewPage() {
  return (
    <AuthGate>
      <PageSitePreview />
    </AuthGate>
  );
}
