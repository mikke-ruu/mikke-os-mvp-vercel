"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useTeamWorksPortalRoles } from "./useTeamWorksPortalRoles";
import { useTeamWorksLabels } from "./useTeamWorksLabels";
import { useIsViewAs } from "./TeamWorksViewAsContext";

export function TeamWorksRoleSwitcher({ current }: { current: "staff" | "client" | "worker" }) {
  const { hasStaff, hasClient, hasWorker, loading } = useTeamWorksPortalRoles();
  const labels = useTeamWorksLabels();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const signOutPending = useRef(false);
  const isViewAs = useIsViewAs();
  const destinations = [
    { role: "staff", label: "本部", href: "/apps/team-works", available: hasStaff },
    { role: "client", label: "クライアント", href: "/apps/team-works/portal/client", available: hasClient },
    { role: "worker", label: labels.workers, href: "/apps/team-works/portal/worker", available: hasWorker }
  ].filter((item) => item.available);

  const showDestinations = !loading && (isViewAs || destinations.length > 1);
  async function signOut() {
    if (signOutPending.current) return;
    signOutPending.current = true;
    setSigningOut(true);
    setSignOutError("");
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      const nextPath = current === "staff" ? "/apps/team-works" : `/apps/team-works/portal/${current}`;
      window.location.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    } catch {
      setSignOutError("ログアウトできませんでした。通信を確認して、もう一度お試しください。");
      signOutPending.current = false;
      setSigningOut(false);
    }
  }
  return (
    <nav aria-label="画面切り替え・ログアウト" className="mb-3 rounded-xl border border-[var(--mikke-line)] bg-white">
      <details>
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-bold text-[var(--mikke-text)] focus-visible:outline-2 focus-visible:outline-[var(--mikke-primary)]">{isViewAs ? "自分の画面・ログアウト" : "画面切り替え・ログアウト"}</summary>
        <div className="px-3 pb-3">
          {showDestinations && <div className="flex flex-wrap items-center gap-2">
            {destinations.map((item) => <Link key={item.role} href={item.href}
              aria-current={!isViewAs && item.role === current ? "page" : undefined}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold ${!isViewAs && item.role === current ? "bg-[var(--mikke-primary)] text-white" : "border border-[var(--mikke-line)] text-[var(--mikke-text)] hover:bg-[var(--mikke-surface)]"}`}>{item.label}</Link>)}
          </div>}
          {showDestinations && <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">自分が参加しているプロジェクトが表示されます。招待を承認する場合は、招待された役割の画面を開いてください。</p>}
          <div className="mt-3 border-t border-[var(--mikke-line)] pt-3">
            <button type="button" onClick={() => void signOut()} disabled={signingOut} className="rounded-xl border border-[var(--mikke-line)] px-4 py-2.5 text-sm font-bold text-[var(--mikke-text)] disabled:opacity-50">{signingOut ? "ログアウトしています…" : "ログアウトして別のアカウントで入る"}</button>
            <p className="mt-2 text-xs leading-5 text-[var(--mikke-muted)]">このブラウザのmikkeからログアウトし、ログイン画面を開きます。</p>
            {signOutError && <p role="alert" className="mt-2 text-sm text-red-700">{signOutError}</p>}
          </div>
        </div>
      </details>
    </nav>
  );
}
