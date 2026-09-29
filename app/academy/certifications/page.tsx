'use client';
import { HonbuShell } from '@/components/academy/AcademyShell';
import { useAcademy2Headquarters } from '@/components/academy2/HeadquartersBoundary';
import { HeadquartersApplications } from '@/components/academy2/HeadquartersApplications';
function CertificationList() {
  const hq = useAcademy2Headquarters();
  return hq ? <HeadquartersApplications key={hq.id} mode="certifications" /> : <p role="status">この一覧はAcademy 2.0の本部で利用できます。</p>;
}
export default function CertificationsPage() {
  return <HonbuShell title="認定"><CertificationList /></HonbuShell>;
}
