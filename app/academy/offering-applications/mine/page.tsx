"use client";
import { KoushiShell } from "@/components/academy/AcademyShell";
import { OfferingApplications } from "@/components/academy/OfferingApplications";
export default function Page() {
  return <KoushiShell title="申し込んだサービス"><OfferingApplications audience="learner" /></KoushiShell>;
}
