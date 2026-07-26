import { AuthGate } from "@/components/AuthGate";
import { TeamWorksOperationsPartnerPortal } from "@/components/team-works/operations/TeamWorksOperationsPartnerPortal";

export default function TeamWorksWorkerPortalPage() {
  return (
    <AuthGate>
      <TeamWorksOperationsPartnerPortal />
    </AuthGate>
  );
}
