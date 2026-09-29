"use client";
import { HonbuShell } from "@/components/academy/AcademyShell";
import { OfferingApplications } from "@/components/academy/OfferingApplications";
import { useAcademy2Headquarters } from "@/components/academy2/HeadquartersBoundary";
import { HeadquartersApplications } from "@/components/academy2/HeadquartersApplications";
function Content() { return useAcademy2Headquarters() ? <HeadquartersApplications /> : <OfferingApplications audience="hq" />; }
export default function Page() {
  return <HonbuShell title="サービスページの申込"><Content /></HonbuShell>;
}
