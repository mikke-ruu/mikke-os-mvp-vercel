"use client";

import { AuthGate } from "@/components/AuthGate";
import { OrderMenuForm } from "@/components/order/OrderMenuForm";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";

export default function OrderAdminNewPage() {
  return (
    <AuthGate>
      <MikkeAppShell appName="Order" title="メニューを作成" currentApp={{ label: "Order", href: "/apps/order" }} footerLabel="Order by mikke">
        <OrderMenuForm />
      </MikkeAppShell>
    </AuthGate>
  );
}
