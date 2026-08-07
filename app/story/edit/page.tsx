"use client";

import { AuthGate } from "@/components/AuthGate";
import { StoryProfileEditor } from "@/components/mikkeos/StoryProfileEditor";
import { StoryAppShell } from "@/components/mikkeos/StoryAppShell";

export default function StoryEditPage() {
  return <AuthGate><StoryAppShell title="STORYを編集" subtitle="編集と見え方を切り替えられます"><StoryProfileEditor mode="edit" /></StoryAppShell></AuthGate>;
}
