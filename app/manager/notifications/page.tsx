import { AuthGate } from "@/components/AuthGate";
import { ManagerNotificationsView } from "@/components/manager/ManagerNotificationsView";

export default function ManagerNotificationsPage() {
  return (
    <AuthGate>
      <ManagerNotificationsView />
    </AuthGate>
  );
}
