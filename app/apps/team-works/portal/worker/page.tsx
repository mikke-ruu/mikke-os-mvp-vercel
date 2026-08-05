"use client";

import { Suspense } from "react";
import { AuthGate } from "@/components/AuthGate";
import { TeamWorksViewAsGate } from "@/components/team-works/TeamWorksViewAsGate";
import { TeamWorksOperationsPartnerPortal } from "@/components/team-works/operations/TeamWorksOperationsPartnerPortal";

export default function TeamWorksWorkerPortalPage() {
  return (
    <AuthGate>
      {/* useSearchParams を使うためSuspense必須(Next.jsのCSR bailout) */}
      <Suspense fallback={null}>
        <TeamWorksViewAsGate role="worker">
          {({ viewAsMemberId, sampleProjectId }) => (
            <TeamWorksOperationsPartnerPortal viewAsMemberId={viewAsMemberId} sampleProjectId={sampleProjectId} />
          )}
        </TeamWorksViewAsGate>
      </Suspense>
    </AuthGate>
  );
}
