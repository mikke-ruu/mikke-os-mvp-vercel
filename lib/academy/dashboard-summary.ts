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
  if (filter === "shipping") return ["kit_pending", "kit_preparing"].includes(a.status);
  if (filter === "unpaid") return a.payment_status === "unpaid" && !["cancelled", "closed"].includes(a.status);
  return true;
}
export function matchesOrder(k: AcademyKitOrder, filter: string) {
  if (filter === "new") return k.status === "received";
  if (filter === "active") return ["received", "awaiting_payment", "paid", "preparing"].includes(k.status);
  if (filter === "shipping") return ["paid", "preparing"].includes(k.status);
  if (filter === "unpaid") return k.payment_status === "unpaid" && !["cancelled", "closed"].includes(k.status);
  return true;
}
export const dashboardFilterLabels: Record<string, string> = { month: "今月に届いた受講申込", new: "新規受付", unpaid: "入金確認待ち", active: "対応中の教材注文", shipping: "準備・発送待ち" };
