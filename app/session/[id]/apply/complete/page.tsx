"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { SessionPublicShell } from "@/components/session/SessionPublicShell";
import { useSessionMenus } from "@/lib/session/store";

export default function SessionApplyCompletePage() {
  const params = useParams<{ id: string }>();
  const { menus } = useSessionMenus();
  const menu = menus.find((item) => item.id === params.id);

  return (
    <SessionPublicShell title="Session">
      <div className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-6 text-center">
        <CheckCircle2 size={40} className="mx-auto text-[var(--mikke-success)]" />
        <h1 className="mt-3 text-lg font-bold tracking-normal text-[var(--mikke-text)]">仮予約を受け付けました</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--mikke-text-soft)]">
          {menu ? `${menu.title}のご予約希望を受け付けました。` : "ご予約希望を受け付けました。"}
          主催者からの確定連絡をお待ちください。
        </p>
        <Link href="/session" className="mt-4 inline-block text-xs font-bold text-[var(--mikke-accent)]">
          メニュー一覧に戻る
        </Link>
      </div>
    </SessionPublicShell>
  );
}
