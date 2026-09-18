import { ManagerAuthGate as AuthGate } from "@/components/manager/ManagerAuthGate";
import { ManagerProfilePanel } from "@/components/manager/ManagerProfilePanel";

export default function ManagerAccountPage() {
  return (
    <AuthGate>
      <ManagerProfilePanel />
    </AuthGate>
  );
}
