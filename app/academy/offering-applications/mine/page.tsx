"use client";
import { KoushiShell } from "@/components/academy/AcademyShell";
import { OfferingApplications } from "@/components/academy/OfferingApplications";
export default function Page() {
  return <KoushiShell title="申し込んだ募集"><OfferingApplications audience="learner" /></KoushiShell>;
}
