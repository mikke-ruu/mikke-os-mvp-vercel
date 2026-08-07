"use client";

import { AuthGate } from "@/components/AuthGate";
import { StoryAppShell } from "@/components/mikkeos/StoryAppShell";
import { StorySharePage } from "@/components/mikkeos/StorySharePage";

export default function StoryShareRoute() {
  return <AuthGate><StoryAppShell title="QR・共有" subtitle="あなたのSTORYを名刺として渡す"><StorySharePage /></StoryAppShell></AuthGate>;
}
