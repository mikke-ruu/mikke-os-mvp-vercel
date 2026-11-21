import { ManagerAuthGate as AuthGate } from "@/components/manager/ManagerAuthGate";
import { ManagerSettingsPanel } from "@/components/manager/ManagerSettingsPanel";

export default function ManagerSettingsPage() {
  return (
    <AuthGate>
      <ManagerSettingsPanel />
    </AuthGate>
  );
}

