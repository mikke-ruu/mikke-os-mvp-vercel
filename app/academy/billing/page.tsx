import { notFound } from "next/navigation";
import { AcademyPlatformBillingPanel } from "./AcademyPlatformBillingPanel";
import type { AcademyPlatformBillingState, AcademySubscriptionStatus } from "@/lib/academy/platform-billing-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Academy利用料・開発確認", robots: { index: false, follow: false } };

const scenarios = ["none", "trialing", "processing", "active", "past_due", "cancel_scheduled", "ended", "loading", "unavailable", "forbidden"] as const;

export default async function AcademyBillingDevelopmentPage({ searchParams }: { searchParams: Promise<{ state?: string | string[] }> }) {
  // This is not a production billing route or a bypass of the existing pilot gates.
  if (process.env.NODE_ENV !== "development") notFound();
  const requested = (await searchParams).state;
  const scenario = scenarios.find((candidate) => candidate === requested) ?? "none";
  const state: AcademyPlatformBillingState = scenario === "loading" || scenario === "unavailable" || scenario === "forbidden"
    ? { kind: scenario }
    : {
      kind: "owner",
      subscriptionStatus: scenario as AcademySubscriptionStatus,
      constructionPurchase: "unverified",
      headquartersState: scenario === "none" ? "not_created" : scenario === "processing" ? "preparing" : "ready",
      nextInvoice: null,
      accessEndsAt: null,
      allowedActions: scenario === "active" || scenario === "past_due" || scenario === "cancel_scheduled" ? ["portal"] : [],
      planKey: scenario === "none" ? null : "fixture_only",
      snapshot: null,
    };
  return <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
    <aside className="rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-accent-soft)] p-4 leading-7 font-semibold">開発確認用：契約状態の表示サンプルです。実際の契約・請求・本部作成は行いません。</aside>
    <nav aria-label="開発用の契約状態" className="flex flex-wrap gap-2">
      {scenarios.map((value) => <a key={value} href={`?state=${value}`} aria-current={scenario === value ? "page" : undefined} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm aria-[current=page]:bg-[var(--mikke-primary)] aria-[current=page]:text-white">{value}</a>)}
    </nav>
    <AcademyPlatformBillingPanel state={state} />
  </main>;
}
