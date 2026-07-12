"use client";

import { AuthGate } from "@/components/AuthGate";
import { StudioItemForm } from "@/components/item-studio/StudioItemForm";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";

export default function ItemStudioNewPage() {
  return (
    <AuthGate>
      <MikkeAppShell appName="Item Studio" title="商品を登録" currentApp={{ label: "Item Studio", href: "/apps/item-studio" }} footerLabel="Item Studio by mikke">
        <StudioItemForm />
      </MikkeAppShell>
    </AuthGate>
  );
}
