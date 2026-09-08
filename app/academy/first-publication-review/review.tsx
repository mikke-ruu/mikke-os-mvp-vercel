"use client";

import { useRef, useState } from "react";
import { AcademyFirstPublicationPanel } from "@/components/academy/AcademyFirstPublicationPanel";
import type { AcademyCourse } from "@/types/database";
import type { FirstPublicationStatus } from "@/lib/academy/first-publication/rpc-client";
import type { FirstPublicationAccess } from "@/lib/academy/first-publication/access-client";

type Mode = "prepared" | "trialing" | "cancelled" | "paid";
type Fixture = { status: FirstPublicationStatus; access: FirstPublicationAccess; course: AcademyCourse };
const day = 24 * 60 * 60 * 1000;
const labels: Record<Mode, string> = { prepared: "公開準備中", trialing: "7日間無料体験中", cancelled: "有料移行取消済み", paid: "有料利用中" };
const control = "min-h-11 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm";

export function firstPublicationReviewFixture(mode: Mode, now: number): Fixture {
  const headquartersId = "00000000-0000-4000-8000-000000000001";
  const first = mode === "prepared" ? null : new Date(now - (mode === "paid" ? 8 : 1) * day).toISOString();
  const end = first ? new Date(Date.parse(first) + 7 * day).toISOString() : null;
  const cancelled = mode === "cancelled" ? new Date(now).toISOString() : null;
  return {
    status: { headquartersId, policyVersion: "academy-first-publication-trial-2026-09-08-v1", termsRevision: "academy-first-publication-trial-terms-2026-09-08-v1", quoteId: "00000000-0000-4000-8000-000000000002", amountYen: 5000, instructorCount: 3, firstPublishedAt: first, trialEndsAt: end, cancellationAcceptedAt: cancelled, phase: mode === "paid" ? "trialing" : mode },
    access: { scheme: "first_publication_168h_v1", policyVersion: "academy-first-publication-trial-2026-09-08-v1", active: mode !== "prepared", inviteAllowed: mode === "trialing" || mode === "paid", endsAt: mode === "paid" ? new Date(now + 30 * day).toISOString() : end, phase: mode, cancellationAcceptedAt: cancelled },
    course: { id: "00000000-0000-4000-8000-000000000003", headquarters_id: headquartersId, user_id: "00000000-0000-4000-8000-000000000004", code: "local-review", name: "操作確認用 はじめての講座", subtitle: null, main_image_url: null, description: null, price: 3000, duration_text: null, formats: ["in_person"], certification_conditions: null, can_do_after: null, kit_contents: null, material_contents: null, faq: [], application_form_fields: [], lp_blocks: [], accept_at_honbu: true, accept_at_koushi: false, is_published: mode !== "prepared", payment_url: null, payment_provider: "manual", kit_price: 0, kit_payment_url: null, requires_kit: false, learner_access_mode: "unlimited", learner_access_days: null, learner_access_fixed_end_at: null, feature_settings: null, sort_order: 0, created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() },
  };
}

export function FirstPublicationReview({ startedAt }: { startedAt: number }) {
  const [mode, setMode] = useState<Mode>("prepared");
  const [view, setView] = useState(() => firstPublicationReviewFixture("prepared", startedAt));
  const stored = useRef(view);
  const [generation, setGeneration] = useState(0);
  const [failure, setFailure] = useState<"none" | "before" | "after">("none");
  const [refreshFailure, setRefreshFailure] = useState(false);
  const [actionCount, setActionCount] = useState(0);
  const [refreshCount, setRefreshCount] = useState(0);
  function reset(next: Mode) {
    const fixture = firstPublicationReviewFixture(next, Date.now());
    setMode(next); setView(fixture); stored.current = fixture; setFailure("none"); setRefreshFailure(false);
    setActionCount(0); setRefreshCount(0); setGeneration(value => value + 1);
  }
  return <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 text-[var(--mikke-text)]">
    <header className="space-y-2"><h1 className="text-xl font-bold">無料期間と公開操作の確認</h1><p className="rounded-lg border border-[#ffd370] p-3 text-sm leading-7">開発環境限定の操作見本です。表示は架空データで、変更はこの画面の中だけに保存します。実際の講座公開・契約・課金・招待・外部通信は行いません。再読み込みすると元に戻ります。</p></header>
    <section aria-label="確認する状態" className="space-y-3 rounded-lg border border-[var(--mikke-line)] p-4">
      <label className="flex flex-wrap items-center gap-2 text-sm">利用状態<select className={control} value={mode} onChange={event => reset(event.target.value as Mode)}>{(Object.keys(labels) as Mode[]).map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
      <label className="flex flex-wrap items-center gap-2 text-sm">次の操作結果<select className={control} value={failure} onChange={event => setFailure(event.target.value as typeof failure)}><option value="none">成功する</option><option value="before">保存前に失敗する</option><option value="after">保存後に結果が届かない</option></select></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={refreshFailure} onChange={event => setRefreshFailure(event.target.checked)} />最新の状態の取得も失敗させる</label>
      <p className="text-xs leading-6">失敗後は再操作できないことを確認します。「最新の状態を確認」が成功すると再操作できます。「保存後に結果が届かない」では、再確認で保存済みの状態が表示されます。</p>
      <p className="text-xs" aria-label="ローカル操作回数">操作要求 {actionCount}回 / 状態の再確認 {refreshCount}回</p>
      <button type="button" className={control} onClick={() => reset(mode)}>この状態を最初から試す</button>
    </section>
    <AcademyFirstPublicationPanel key={generation} identityKey={`local-only-${generation}`} state={view.status} access={view.access} course={view.course} allowedActions={view.access.phase === "prepared" ? ["publish"] : view.access.phase === "trialing" ? ["publish", "unpublish", "cancel_conversion"] : ["publish", "unpublish"]} onAction={async action => {
      setActionCount(value => value + 1);
      if (failure === "before") { setFailure("none"); throw new Error("local_simulated_before_save"); }
      const next: Fixture = { status: { ...stored.current.status }, access: { ...stored.current.access }, course: { ...stored.current.course } };
      if (action === "publish") {
        next.course.is_published = true;
        if (!next.status.firstPublishedAt) {
          const now = Date.now();
          next.status.firstPublishedAt = new Date(now).toISOString(); next.status.trialEndsAt = new Date(now + 7 * day).toISOString(); next.status.phase = "trialing";
          next.access = { ...next.access, phase: "trialing", active: true, inviteAllowed: true, endsAt: next.status.trialEndsAt };
        }
      } else if (action === "unpublish") next.course.is_published = false;
      else {
        next.status.cancellationAcceptedAt = new Date().toISOString(); next.status.phase = "cancelled";
        next.access = { ...next.access, phase: "cancelled", inviteAllowed: false, cancellationAcceptedAt: next.status.cancellationAcceptedAt };
      }
      stored.current = next;
      if (failure === "after") { setFailure("none"); throw new Error("local_simulated_after_save"); }
      setView(next);
    }} onRefresh={async () => {
      setRefreshCount(value => value + 1);
      if (refreshFailure) throw new Error("local_simulated_read_failure");
      setView(stored.current);
    }} />
  </main>;
}
