"use client";

import { Fragment, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthGate";

/** Discard the previous account/Academy's loaded data and open forms on navigation. */
export function AcademyContextBoundary({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const pathname = usePathname();
  return <Fragment key={`${profile.user_id}:${pathname}`}>{children}</Fragment>;
}
