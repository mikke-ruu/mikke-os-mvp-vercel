import { AuthGate } from "@/components/AuthGate";
import { ManagerSettingsPanel } from "@/components/manager/ManagerSettingsPanel";

export default function ManagerSettingsPage() {
  return (
    <AuthGate>
      <ManagerSettingsPanel />
    </AuthGate>
  );
}

