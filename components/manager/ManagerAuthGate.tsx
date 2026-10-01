"use client";

import { Fragment, type ReactNode } from "react";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { canRenderManagerAccount } from "@/lib/manager/account-boundary";

function ManagerAccountContent({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  if (!canRenderManagerAccount(user.id, profile.user_id)) {
    return <p role="status" className="p-6 text-sm text-[var(--mikke-muted)]">アカウントを確認しています…</p>;
  }
  // A new account must not inherit the previous account's form or data state.
  return <Fragment key={user.id}>{children}</Fragment>;
}

export function ManagerAuthGate({ children }: { children: ReactNode }) {
  return <AuthGate><ManagerAccountContent>{children}</ManagerAccountContent></AuthGate>;
}
