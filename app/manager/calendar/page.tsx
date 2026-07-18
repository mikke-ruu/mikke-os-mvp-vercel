import { AuthGate } from "@/components/AuthGate";
import { ManagerCalendarView } from "@/components/manager/ManagerCalendarView";

export default function ManagerCalendarPage() {
  return (
    <AuthGate>
      <ManagerCalendarView />
    </AuthGate>
  );
}

