import { redirect } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { PlatformBillingReturnCard } from "@/components/billing/PlatformBillingReturnCard";

export const dynamic = "force-dynamic";

export default async function BillingCancelPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  if (Object.keys(query).length > 0) redirect("/billing/cancel");

  return (
    <AuthGate>
      <PlatformBillingReturnCard outcome="cancel" />
    </AuthGate>
  );
}
