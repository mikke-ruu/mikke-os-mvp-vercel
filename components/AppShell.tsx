"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "./AuthGate";
import { BottomNav } from "./BottomNav";

export function AppShell({
  title,
  subtitle,
  hideHeader = false,
  hideBottomNav = false,
  maxWidth = "max-w-md",
  children
}: {
  title: string;
  subtitle?: string;
  hideHeader?: boolean;
  hideBottomNav?: boolean;
  /** コンテンツ幅。既定はスマホ幅（既存アプリ互換）。Academy管理画面は max-w-5xl 等を渡す */
  maxWidth?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { profile } = useAuth();

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="safe-bottom min-h-screen bg-[#fbfaf8]">
      {hideHeader ? null : (
        <header className="sticky top-0 z-20 border-b border-[#e8e1da] bg-[#fbfaf8]/95 px-4 py-4 backdrop-blur">
          <div className={`mx-auto flex ${maxWidth} items-center justify-between gap-3`}>
            <div>
              <p className="text-xs font-bold text-[#d9643a]">Mikke OS</p>
              <h1 className="text-xl font-bold tracking-normal text-[#25211f]">{title}</h1>
              {subtitle ? <p className="mt-1 text-xs text-[#79716b]">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-full border border-[#e8e1da] bg-white p-2 text-[#79716b]"
              aria-label="ログアウト"
              title={`${profile.display_name} からログアウト`}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
      )}
      <div className={`mx-auto ${maxWidth} px-4 py-4 ${hideBottomNav ? "" : "pb-24"}`}>{children}</div>
      {hideBottomNav ? null : <BottomNav />}
    </main>
  );
}
