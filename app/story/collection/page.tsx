"use client";

import { AuthGate } from "@/components/AuthGate";
import { StoryAppShell } from "@/components/mikkeos/StoryAppShell";
import { StoryCollectionPage } from "@/components/mikkeos/StoryCollectionPage";

export default function StoryCollectionRoute() {
  return <AuthGate><StoryAppShell title="コレクション" subtitle="受け取ったSTORYは自分だけに表示されます"><StoryCollectionPage /></StoryAppShell></AuthGate>;
}
