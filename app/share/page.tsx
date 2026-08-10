import { Suspense } from "react";
import { MikkeShareHub } from "@/components/mikkeos/MikkeShareHub";

export default function SharePage() {
  return <Suspense fallback={<main className="min-h-dvh bg-[var(--mikke-surface-soft)]" />}><MikkeShareHub /></Suspense>;
}
