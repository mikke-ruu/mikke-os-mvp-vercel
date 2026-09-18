import { ManagerAuthGate as AuthGate } from "@/components/manager/ManagerAuthGate";
import { ManagerCalendarView } from "@/components/manager/ManagerCalendarView";

export default function ManagerPersonalEventsPage() {
  return (
    <AuthGate>
      <ManagerCalendarView legacyOnly />
    </AuthGate>
  );
}
