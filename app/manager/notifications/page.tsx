import { ManagerAuthGate as AuthGate } from "@/components/manager/ManagerAuthGate";
import { ManagerNotificationsView } from "@/components/manager/ManagerNotificationsView";

export default function ManagerNotificationsPage() {
  return (
    <AuthGate>
      <ManagerNotificationsView />
    </AuthGate>
  );
}
