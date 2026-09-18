"use client";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { OfferingApplications } from "@/components/academy/OfferingApplications";
export default function Page() {
  return <HonbuShell title="募集ページの申込"><OfferingApplications audience="hq" /></HonbuShell>;
}
