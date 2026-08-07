"use client";

import { AuthGate } from "@/components/AuthGate";
import { StoryProfileEditor } from "@/components/mikkeos/StoryProfileEditor";

export default function StoryStartPage() {
  return <AuthGate><StoryProfileEditor mode="start" /></AuthGate>;
}
