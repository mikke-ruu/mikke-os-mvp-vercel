"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { TeamWorksViewAsGate } from "@/components/team-works/TeamWorksViewAsGate";
import { TeamWorksPartnerLessonWindow } from "@/components/team-works/operations/TeamWorksOperationsPartnerPortal";

function PartnerLessonContent() {
  const params = useParams<{ sessionId: string }>();
  return (
    <TeamWorksViewAsGate role="worker">
      {({ viewAsMemberId, sampleProjectId }) => (
        <TeamWorksPartnerLessonWindow sessionId={params.sessionId} viewAsMemberId={viewAsMemberId} sampleProjectId={sampleProjectId} />
      )}
    </TeamWorksViewAsGate>
  );
}

export default function PartnerLessonPage() {
  return (
    <AuthGate>
      {/* TeamWorksViewAsGate が useSearchParams を使うためSuspense必須 */}
      <Suspense fallback={null}>
        <PartnerLessonContent />
      </Suspense>
    </AuthGate>
  );
}
