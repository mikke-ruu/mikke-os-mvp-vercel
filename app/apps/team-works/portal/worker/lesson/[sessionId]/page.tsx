"use client";

import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { TeamWorksPartnerLessonWindow } from "@/components/team-works/operations/TeamWorksOperationsPartnerPortal";

function PartnerLessonContent() {
  const params = useParams<{ sessionId: string }>();
  return <TeamWorksPartnerLessonWindow sessionId={params.sessionId} />;
}

export default function PartnerLessonPage() {
  return <AuthGate><PartnerLessonContent /></AuthGate>;
}
