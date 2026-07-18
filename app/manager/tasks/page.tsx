import { AuthGate } from "@/components/AuthGate";
import { ManagerTaskList } from "@/components/manager/ManagerTaskList";

export default function ManagerTasksPage() {
  return (
    <AuthGate>
      <ManagerTaskList />
    </AuthGate>
  );
}

