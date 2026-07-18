import { AuthGate } from "@/components/AuthGate";
import { PageDashboard } from "@/components/page/PageDashboard";

export default function PageAppPage() {
  return (
    <AuthGate>
      <PageDashboard />
    </AuthGate>
  );
}
