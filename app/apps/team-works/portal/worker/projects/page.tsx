"use client";

import { AuthGate } from "@/components/AuthGate";
import { TeamWorksWorkerProjectList } from "@/components/team-works/worker-projects/TeamWorksWorkerProjectList";
import { TeamWorksWorkerProjectsShell } from "@/components/team-works/worker-projects/TeamWorksWorkerProjectsShell";

export default function TeamWorksWorkerProjectsPage() {
  return <AuthGate><TeamWorksWorkerProjectsShell title="担当プロジェクト" subtitle="自分の工程・タスク・成果物を確認する"><TeamWorksWorkerProjectList /></TeamWorksWorkerProjectsShell></AuthGate>;
}
