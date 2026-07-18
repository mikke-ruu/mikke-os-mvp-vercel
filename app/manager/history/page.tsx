import { AuthGate } from "@/components/AuthGate";
import { ManagerHistoryList } from "@/components/manager/ManagerHistoryList";

export default function ManagerHistoryPage() {
  return (
    <AuthGate>
      <ManagerHistoryList />
    </AuthGate>
  );
}

