"use client";

import { AuthGate } from "@/components/AuthGate";
import { StoryProfileEditor } from "@/components/mikkeos/StoryProfileEditor";
import { StoryAppShell } from "@/components/mikkeos/StoryAppShell";

export default function StoryStartPage() {
  return <AuthGate><StoryAppShell title="STORYをつくる"><StoryProfileEditor mode="start" /></StoryAppShell></AuthGate>;
}
