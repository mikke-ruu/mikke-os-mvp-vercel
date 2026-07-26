"use client";

import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { TeamWorksProjectDetailRoute } from "@/components/team-works/operations/TeamWorksOperationsProjectDetail";

function TeamWorksProjectDetailContent() {
  const params = useParams<{ projectId: string }>();
  return <TeamWorksProjectDetailRoute projectId={params.projectId} />;
}

export default function TeamWorksProjectDetailPage() {
  return <AuthGate><TeamWorksProjectDetailContent /></AuthGate>;
}
