import { AuthGate } from "@/components/AuthGate";
import { TeamWorksOperationsClientPortal } from "@/components/team-works/operations/TeamWorksOperationsClientPortal";

export default function TeamWorksClientPortalPage() {
  return (
    <AuthGate>
      <TeamWorksOperationsClientPortal />
    </AuthGate>
  );
}
