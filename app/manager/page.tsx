import { AuthGate } from "@/components/AuthGate";
import { ManagerDashboard } from "@/components/manager/ManagerDashboard";

export default function ManagerPage() {
  return (
    <AuthGate>
      <ManagerDashboard />
    </AuthGate>
  );
}

