"use client";

import { LegacyHonbuShell } from '@/components/academy/AcademyShell';
import { OfferingApplications } from '@/components/academy/OfferingApplications';
import { getAcademyRouteContext, toAcademyContextHref } from '@/lib/academy/access-context';

/** Keep the legacy owner checks, RLS, purchase snapshots and operations intact. */
function LegacyApplications() {
  const id = getAcademyRouteContext()?.academyId;
  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
    <a className="inline-flex min-h-11 items-center rounded-xl border bg-white px-4 text-sm font-semibold" href={id ? toAcademyContextHref('/academy/offering-applications', id, 'manage') : '/academy/offering-applications'}>← 申込一覧へ</a>
    <div><h1 className="text-xl font-semibold">旧申込の確認</h1><p className="mt-2 text-sm leading-relaxed text-[#4b535e]">申込時の講座内容・金額・支払い・修了の記録を確認できます。</p></div>
    <OfferingApplications audience="hq" />
  </main>;
}

export default function Page() { return <LegacyHonbuShell title="旧申込の確認"><LegacyApplications /></LegacyHonbuShell>; }
