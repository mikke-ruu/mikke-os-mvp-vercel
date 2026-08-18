"use client";

import { AuthGate } from "@/components/AuthGate";
import { StoryAppShell } from "@/components/mikkeos/StoryAppShell";
import { StorySharePage } from "@/components/mikkeos/StorySharePage";

export default function StoryShareRoute() {
  return <AuthGate><StoryAppShell title="自分のSTORYを共有（QR）" subtitle="公開中のSTORYを名刺として渡す"><StorySharePage /></StoryAppShell></AuthGate>;
}
