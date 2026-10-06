import { ManagerAuthGate as AuthGate } from "@/components/manager/ManagerAuthGate";
import { ManagerDashboard } from "@/components/manager/ManagerDashboard";

export default function ManagerPage() {
  return (
    <AuthGate>
      <ManagerDashboard />
    </AuthGate>
  );
}

