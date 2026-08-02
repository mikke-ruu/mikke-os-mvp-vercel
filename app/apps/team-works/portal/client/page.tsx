import { Suspense } from "react";
import { AuthGate } from "@/components/AuthGate";
import { TeamWorksViewAsGate } from "@/components/team-works/TeamWorksViewAsGate";
import { TeamWorksOperationsClientPortal } from "@/components/team-works/operations/TeamWorksOperationsClientPortal";

export default function TeamWorksClientPortalPage() {
  return (
    <AuthGate>
      {/* useSearchParams を使うためSuspense必須(Next.jsのCSR bailout) */}
      <Suspense fallback={null}>
        <TeamWorksViewAsGate role="client">
          <TeamWorksOperationsClientPortal />
        </TeamWorksViewAsGate>
      </Suspense>
    </AuthGate>
  );
}
