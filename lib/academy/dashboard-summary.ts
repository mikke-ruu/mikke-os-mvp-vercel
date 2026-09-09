import type { AcademyApplication, AcademyKitOrder } from "@/types/database";

export function academyMonth(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).formatToParts(date);
  return parts.find(p => p.type === "year")!.value + "-" + parts.find(p => p.type === "month")!.value;
}
export function matchesApplication(a: AcademyApplication, filter: string, month = academyMonth(new Date())) {
  if (filter === "month") return academyMonth(a.created_at) === month;
  if (filter === "new") return a.status === "received";
  if (filter === "unpaid") return a.payment_status === "unpaid" && !["cancelled", "closed"].includes(a.status);
  return true;
}
export function matchesOrder(k: AcademyKitOrder, filter: string) {
  if (filter === "active") return ["received", "awaiting_payment", "paid", "preparing"].includes(k.status);
  if (filter === "shipping") return ["paid", "preparing"].includes(k.status);
  if (filter === "unpaid") return k.payment_status === "unpaid" && !["cancelled", "closed"].includes(k.status);
  return true;
}
export const dashboardFilterLabels: Record<string, string> = { month: "今月に届いた受講申込", new: "新しい受講申込", unpaid: "入金確認待ち", active: "対応中の教材注文", shipping: "発送準備・発送待ち" };
