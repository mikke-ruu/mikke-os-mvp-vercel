"use client";
import { AuthGate } from "@/components/AuthGate";
import { OfferingApplications } from "@/components/academy/OfferingApplications";
export default function Page() {
  return <AuthGate><main className="mx-auto max-w-4xl px-4 py-8"><h1 className="mb-6 text-2xl font-bold">自分の申込</h1><OfferingApplications audience="learner" /></main></AuthGate>;
}
