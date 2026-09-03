import { AuthGate } from "@/components/AuthGate";
import { ManagerCalendarView } from "@/components/manager/ManagerCalendarView";

export default function ManagerPersonalEventsPage() {
  return (
    <AuthGate>
      <ManagerCalendarView legacyOnly />
    </AuthGate>
  );
}
