import { ManagerAuthGate as AuthGate } from "@/components/manager/ManagerAuthGate";
import { ManagerHistoryList } from "@/components/manager/ManagerHistoryList";

export default function ManagerHistoryPage() {
  return (
    <AuthGate>
      <ManagerHistoryList />
    </AuthGate>
  );
}

