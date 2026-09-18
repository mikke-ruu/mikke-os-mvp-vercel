import { supabase } from "@/lib/supabase/client";
import { assertAcademyWritable } from "@/lib/academy/preview";
import type { LpBlock } from "@/components/mikkeos/page-builder/lp-design";

export const offeringKinds = ["ワークショップ", "単品講座", "コース", "認定講座", "全講座", "月額レッスン"] as const;
export type OfferingInput = {
  title: string;
  kind: typeof offeringKinds[number];
  course_ids: string[];
  price: number;
  payment_methods: ("bank" | "onsite")[];
  purchase_mode: "all" | "staged";
  completion_mode: "learner" | "hq";
  stage_prices: Record<string, number>;
  lp_blocks: LpBlock[];
  status: "draft" | "published" | "archived";
};
export type AcademyOffering = OfferingInput & {
  id: string; headquarters_id: string; currency: "JPY"; created_by: string; created_at: string; updated_at: string;
};
export function blankOfferingInput(): OfferingInput {
  return { title: "", kind: "ワークショップ", course_ids: [], price: Number.NaN, payment_methods: ["bank"], purchase_mode: "all", completion_mode: "learner", stage_prices: {}, lp_blocks: [], status: "draft" };
}
export function offeringInput(value: AcademyOffering): OfferingInput {
  return { title: value.title, kind: value.kind, course_ids: [...value.course_ids], price: Number(value.price), payment_methods: [...value.payment_methods], purchase_mode: value.purchase_mode, completion_mode: value.completion_mode ?? "learner", stage_prices: { ...value.stage_prices }, lp_blocks: structuredClone(value.lp_blocks), status: value.status };
}
export function offeringProblem(input: OfferingInput): string | null {
  if (!input.title.trim()) return "募集名を入力してください。";
  if (!Number.isSafeInteger(input.price) || input.price < 0) return "募集価格は0円以上の整数で入力してください。";
  if (new Set(input.course_ids).size !== input.course_ids.length) return "講座が重複しています。選び直してください。";
  if (input.status === "published") {
    if (!input.course_ids.length) return "公開する講座を1つ以上選んでください。";
    if (input.kind === "月額レッスン") return "月額レッスンは準備中です。下書きで保存してください。";
    if (input.purchase_mode === "staged" && (input.course_ids.length < 2 || Object.keys(input.stage_prices).length !== input.course_ids.length || input.course_ids.some(id => !Number.isSafeInteger(input.stage_prices[id]) || input.stage_prices[id] < 0))) return "講座ごとの支払いは2講座以上を選び、各講座の価格を入力してください。";
    if (!input.payment_methods.length) return "無料の募集も支払い方法を1つ選んでください。";
  }
  return null;
}
function payload(input: OfferingInput) {
  const problem = offeringProblem(input);
  if (problem) throw new Error(problem);
  // Never spread a fetched row into a write: HQ, creator and timestamps are immutable here.
  return { title: input.title.trim(), kind: input.kind, course_ids: input.course_ids, price: input.price, payment_methods: input.payment_methods, purchase_mode: input.purchase_mode, completion_mode: input.completion_mode, stage_prices: input.stage_prices, lp_blocks: input.lp_blocks, status: input.status };
}
export function offeringError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (code === "42P01" || code === "PGRST205") return "募集機能の準備が完了していません。時間をおいて再読み込みしてください。";
  if (code === "42501") return "この本部の募集を変更する権限がありません。";
  if (code === "23514" || code === "P0001") return "講座の所属、価格、公開設定を確認してください。月額レッスンは下書きのみ保存できます。";
  return error instanceof Error ? error.message : "募集データを処理できませんでした。入力内容を確認して、もう一度お試しください。";
}
export async function listOfferings(headquartersId: string) {
  const { data, error } = await supabase.from("academy_offerings").select("*").eq("headquarters_id", headquartersId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AcademyOffering[];
}
export async function getOffering(headquartersId: string, id: string) {
  const { data, error } = await supabase.from("academy_offerings").select("*").eq("headquarters_id", headquartersId).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as AcademyOffering | null;
}
export async function createOffering(headquartersId: string, userId: string, input: OfferingInput) {
  assertAcademyWritable();
  const { data, error } = await supabase.from("academy_offerings").insert({ ...payload(input), headquarters_id: headquartersId, created_by: userId }).select("*").single();
  if (error) throw error;
  return data as AcademyOffering;
}
export async function updateOffering(headquartersId: string, id: string, input: OfferingInput) {
  assertAcademyWritable();
  const { data, error } = await supabase.from("academy_offerings").update(payload(input)).eq("headquarters_id", headquartersId).eq("id", id).select("*").single();
  if (error) throw error;
  return data as AcademyOffering;
}
export async function archiveOffering(headquartersId: string, id: string) {
  assertAcademyWritable();
  const { data, error } = await supabase.from("academy_offerings").update({ status: "archived" }).eq("headquarters_id", headquartersId).eq("id", id).select("*").single();
  if (error) throw error;
  return data as AcademyOffering;
}
