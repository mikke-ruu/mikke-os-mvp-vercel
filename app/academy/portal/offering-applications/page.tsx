"use client";
import { KoushiShell } from "@/components/academy/AcademyShell";
import { OfferingApplications } from "@/components/academy/OfferingApplications";
export default function Page() {
  return <KoushiShell title="自分の募集ページからの申込"><OfferingApplications audience="instructor" /></KoushiShell>;
}
