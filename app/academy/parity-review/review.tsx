"use client";
import { AuthGate } from "@/components/AuthGate";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { OfferingEditor } from "@/components/academy/OfferingEditor";
import { academyPreviewCourses } from "@/lib/academy/preview";
/** Development-only visual harness. No storage or write callbacks. */
export function OfferingParityReview() {
  return <AuthGate><MikkeAppShell appName="Academy" title="Academy"><div className="mx-auto max-w-[960px]"><p className="mb-4 border-l-2 border-orange-500 pl-2 text-xs">表示確認用です。保存・申込・公開は行いません。</p><OfferingEditor courses={academyPreviewCourses} onSave={async () => { throw new Error("確認画面では保存できません。"); }} /></div></MikkeAppShell></AuthGate>;
}
