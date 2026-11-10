"use client";
import { AuthGate } from "@/components/AuthGate";
import { OfferingApplications } from "@/components/academy/OfferingApplications";
import Link from 'next/link';
export default function Page() {
  return <AuthGate><main className="mx-auto max-w-4xl px-4 py-8"><h1 className="mb-6 text-2xl font-bold">自分の申込</h1><Link href="/academy/guest-materials" className="mb-5 inline-flex min-h-11 items-center underline">ログインせずに申し込んだ講座の教材を受け取る</Link><OfferingApplications audience="learner" /></main></AuthGate>;
}
