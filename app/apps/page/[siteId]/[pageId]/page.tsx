"use client";

import { AuthGate } from "@/components/AuthGate";
import { PageDocumentEditor } from "@/components/page/PageDocumentEditor";

export default function PageDocumentPage() {
  return (
    <AuthGate>
      <PageDocumentEditor />
    </AuthGate>
  );
}
