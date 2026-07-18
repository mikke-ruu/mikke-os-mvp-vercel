import { AuthGate } from "@/components/AuthGate";
import { ManagerProgressBoard } from "@/components/manager/ManagerProgressBoard";

export default function ManagerProgressPage() {
  return (
    <AuthGate>
      <ManagerProgressBoard />
    </AuthGate>
  );
}

