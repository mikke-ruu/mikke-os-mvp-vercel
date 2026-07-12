"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { OrderPublicShell } from "@/components/order/OrderPublicShell";
import { useOrderMenus } from "@/lib/order/store";

export default function OrderApplyCompletePage() {
  const params = useParams<{ id: string }>();
  const { menus } = useOrderMenus();
  const menu = menus.find((item) => item.id === params.id);

  return (
    <OrderPublicShell title="Order">
      <div className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-6 text-center">
        <CheckCircle2 size={40} className="mx-auto text-[var(--mikke-success)]" />
        <h1 className="mt-3 text-lg font-bold tracking-normal text-[var(--mikke-text)]">お申込みを受け付けました</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--mikke-text-soft)]">
          {menu ? `${menu.title}のお申込みを受け付けました。` : "お申込みを受け付けました。"}
          追ってご連絡いたしますので、少々お待ちください。
        </p>
        <Link href="/order" className="mt-4 inline-block text-xs font-bold text-[var(--mikke-accent)]">
          メニュー一覧に戻る
        </Link>
      </div>
    </OrderPublicShell>
  );
}
