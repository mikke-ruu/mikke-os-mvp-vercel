"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksOperationsShell } from "@/components/team-works/operations/TeamWorksOperationsShell";
import { TeamWorksPortalShare } from "@/components/team-works/operations/TeamWorksPortalShare";

export default function TeamWorksPortalSharePage() {
  return <AuthGate><TeamWorksOperationsShell title="ポータルを共有" subtitle="クライアント・パートナーへ入口をご案内します"><TeamWorksPortalShare /></TeamWorksOperationsShell></AuthGate>;
}
