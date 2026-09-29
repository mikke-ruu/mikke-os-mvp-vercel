import { supabase } from "@/lib/supabase/client";
import { assertAcademyWritable } from "@/lib/academy/preview";
import type { LpBlock } from "@/components/mikkeos/page-builder/lp-design";

export type SalesPageDraft = {
  plan_id: string; headquarters_id: string; revision: number; plan_revision: number;
  current_plan_revision: number; blocks: LpBlock[]; updated_at: string | null;
  needs_rebase: boolean; published: false;
};
function pageError(error: { code?: string }): Error {
  if (error.code === "42501") return new Error("この販売ページを確認・編集する権限がありません。");
  if (error.code === "PT409") return new Error("販売プランまたはページが更新されています。入力内容を残したまま、最新の保存内容を確認してください。");
  if (error.code === "22023") return new Error("ページの内容を確認してください。講座カードには、この販売プランに含まれる講座を選んでください。");
  return new Error("販売ページを処理できませんでした。入力内容は残っています。もう一度お試しください。");
}
export async function getSalesPage(headquartersId: string, planId: string): Promise<SalesPageDraft> {
  const { data, error } = await supabase.rpc("academy2_sales_page", { p_headquarters_id: headquartersId, p_plan_id: planId }).abortSignal(AbortSignal.timeout(30_000));
  if (error) throw pageError(error);
  return data as SalesPageDraft;
}
export async function saveSalesPage(headquartersId: string, planId: string, expectedRevision: number, expectedPlanRevision: number, blocks: LpBlock[]): Promise<SalesPageDraft> {
  assertAcademyWritable();
  const { data, error } = await supabase.rpc("academy2_save_sales_page", { p_headquarters_id: headquartersId, p_plan_id: planId, p_expected_revision: expectedRevision, p_expected_plan_revision: expectedPlanRevision, p_blocks: blocks }).abortSignal(AbortSignal.timeout(30_000));
  if (error) throw pageError(error);
  return data as SalesPageDraft;
}
