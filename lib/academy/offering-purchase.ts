export type OfferingPurchaseHistory = {
  id: string; offering_id: string; headquarters_id: string; offering_title: string;
  status: string; price: number; stage_index: number; completed_at: string | null;
  purchase_snapshot: { course_ids?: string[]; stage_prices?: Record<string, number>; completion_mode?: "learner" | "hq"; payment_methods?: ("bank" | "onsite")[]; courses?: { id: string; name: string }[] } | null;
};

export function offeringPurchaseState(offering: { purchase_mode: "all" | "staged"; course_ids: string[]; stage_prices: Record<string, number>; price: number }, history: OfferingPurchaseHistory[]) {
  const latest = [...history].sort((a, b) => b.stage_index - a.stage_index)[0];
  if (latest?.stage_index === 0 || (!latest && offering.purchase_mode === "all")) return { amount: Number(latest?.price ?? offering.price), stage: 0, courseName: "", current: latest, complete: Boolean(latest), blocked: Boolean(latest) };
  const ids = latest?.purchase_snapshot?.course_ids ?? offering.course_ids;
  const prices = latest?.purchase_snapshot?.stage_prices ?? offering.stage_prices;
  const stage = latest ? latest.stage_index + (latest.completed_at ? 1 : 0) : 1;
  const complete = stage > ids.length;
  const courseId = ids[stage - 1];
  return { amount: Number(prices[courseId]), stage, courseName: latest?.purchase_snapshot?.courses?.find(course => course.id === courseId)?.name ?? "", current: latest, complete, blocked: Boolean(latest && !latest.completed_at) || complete };
}
