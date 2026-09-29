import { supabase } from "@/lib/supabase/client";
import {SIX_STEP_REVIEW_PLAN} from './plan-review';
import { assertAcademyWritable } from "@/lib/academy/preview";
import type { SalesPlan, SalesPlanType } from "./sales-plan.mjs";

/** Inert draft settings. Publication/readiness must be validated separately. */
export type SalesPlanDraftConfiguration = {
  title: string;
  kind: SalesPlanType;
  course_ids: string[];
  price: number | null;
  purchase_mode: "all" | "staged";
  stage_prices: Record<string, number | null>;
  monthly?: Partial<Omit<NonNullable<SalesPlan["monthly"]>, "months">> & { months: { month: string; course_ids: string[]; materials?: boolean; kit?: boolean }[] };
} & Partial<Omit<SalesPlan, "id" | "headquarters_id" | "title" | "kind" | "course_ids" | "price" | "purchase_mode" | "stage_prices" | "monthly">>;
export type SalesPlanDraft = {
  id: string;
  headquarters_id: string;
  revision: number;
  status: "draft";
  configuration: SalesPlanDraftConfiguration;
  course_snapshot: { course_id: string; title: string }[];
  reference_price_snapshot: { course_id: string; amount: number | null; source: "reference_source_pending" | "academy2_course_settings"; source_revision?: number | null }[];
  sale_price_snapshot: { currency: "JPY"; purchase_mode: "all" | "staged"; price: number | null; stage_prices: Record<string, number | null> };
  publication_hold: true;
  hold_reasons: string[];
  created_at: string;
  updated_at: string;
};

function draftError(error: { code?: string;message?:string }): Error {
  if(error.message==='academy2_shipping_unconfigured')return new Error('選択した講座の発送物設定を保存してください。');
  if(error.message==='academy2_card_contract_required')return new Error('講師向け料金の回収にはAcademyカード決済の契約が必要です。決済設定を確認してください。');
  if(error.message==='academy2_invalid_instructor_fee')return new Error('講師向け料金は税込の整数で入力してください。金額未設定の下書きも保存できます。');
  if (error.code === "42501") return new Error("この本部の販売プランまたは選択した講座を扱う権限がありません。");
  if (error.code === "PT409") return new Error("別の変更が保存されています。入力内容を控えて、最新の下書きを読み直してください。");
  if (error.code === "22023" || error.code === "22P02") return new Error("販売タイプ・講座・金額の入力を確認してください。");
  if (error.code === "PGRST202" || error.code === "42883") return new Error("販売プランの下書き保存を準備しています。");
  return new Error("下書きを処理できませんでした。入力内容を残したまま、もう一度お試しください。");
}

export async function getSalesPlanDraft(headquartersId: string, id: string): Promise<SalesPlanDraft> {
  const { data, error } = await supabase.rpc("academy2_sales_plan_draft", { p_headquarters_id: headquartersId, p_id: id });
  if (error) throw draftError(error);
  return data as SalesPlanDraft;
}

export async function listSalesPlanDrafts(headquartersId: string): Promise<SalesPlanDraft[]> {
  const { data, error } = await supabase.rpc("academy2_sales_plan_drafts", { p_headquarters_id: headquartersId });
  if (error) throw draftError(error);
  return data as SalesPlanDraft[];
}

/** Keep the generated ID across retries. expectedRevision=0 creates a new draft. */
export async function saveSalesPlanDraft(headquartersId: string, id: string, expectedRevision: number, configuration: SalesPlanDraftConfiguration): Promise<SalesPlanDraft> {
  assertAcademyWritable();
  const { data, error } = await supabase.rpc("academy2_save_plan_six_step", {
    p_headquarters_id: headquartersId, p_id: id, p_expected_revision: expectedRevision,
    p_configuration: configuration,
  });
  if (error) throw draftError(error);
  return data as SalesPlanDraft;
}
