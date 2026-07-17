"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksInviteAccept } from "@/components/team-works/TeamWorksInviteAccept";

export default function TeamWorksInvitePage() {
  return <AuthGate><TeamWorksInviteAccept /></AuthGate>;
}
