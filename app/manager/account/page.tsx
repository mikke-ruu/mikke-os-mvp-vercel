import { AuthGate } from "@/components/AuthGate";
import { ManagerProfilePanel } from "@/components/manager/ManagerProfilePanel";

export default function ManagerAccountPage() {
  return (
    <AuthGate>
      <ManagerProfilePanel />
    </AuthGate>
  );
}
