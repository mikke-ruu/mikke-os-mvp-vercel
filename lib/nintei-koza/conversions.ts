import { supabase } from "@/lib/supabase/client";
import type { NinteiKozaConversion, NinteiKozaProduct, NinteiKozaReferrer } from "@/types/database";

export const PRODUCT_LABELS: Record<NinteiKozaProduct, string> = {
  textbook: "完全版",
  kobetsu: "個別構築コース",
  academy: "Academy",
  community: "Community"
};

function findActiveReferrer(referral: string | null, referrers: NinteiKozaReferrer[]) {
  if (!referral) return null;
  return referrers.find((x) => x.code === referral && x.active) ?? null;
}

// お礼対象かどうかを判定(完全版/個別構築のみ、かつ紹介者がその商品を対象にしているか)
export function calcRewardDue(product: NinteiKozaProduct, referral: string | null, referrers: NinteiKozaReferrer[]): boolean {
  if (product !== "textbook" && product !== "kobetsu") return false;
  const r = findActiveReferrer(referral, referrers);
  if (!r) return false;
  return product === "textbook" ? r.reward_textbook : r.reward_kobetsu;
}

// お礼金額を紹介者の設定から引く。対象外・未設定(0)は null を返す。
export function calcRewardAmount(
  product: NinteiKozaProduct,
  referral: string | null,
  referrers: NinteiKozaReferrer[]
): number | null {
  if (!calcRewardDue(product, referral, referrers)) return null;
  const r = findActiveReferrer(referral, referrers);
  if (!r) return null;
  const amount = product === "textbook" ? r.reward_textbook_amount : r.reward_kobetsu_amount;
  return amount > 0 ? amount : null;
}

export async function listConversions() {
  const { data, error } = await supabase
    .from("nintei_koza_conversions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as NinteiKozaConversion[];
}

export type ConversionInput = {
  inquiryId: string | null;
  product: NinteiKozaProduct;
  amount: number | null;
  referral: string | null;
  note: string | null;
};

export async function createConversion(input: ConversionInput, referrers: NinteiKozaReferrer[]) {
  const reward_due = calcRewardDue(input.product, input.referral, referrers);
  const reward_amount = calcRewardAmount(input.product, input.referral, referrers);
  // owner_user_id はDB既定値の auth.uid() が入る（RLSの with check と一致する）
  const { data, error } = await supabase
    .from("nintei_koza_conversions")
    .insert({
      inquiry_id: input.inquiryId,
      product: input.product,
      amount: input.amount,
      referral: input.referral,
      reward_due,
      reward_amount,
      note: input.note
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as NinteiKozaConversion;
}

export async function markRewardDone(id: string, done: boolean) {
  const { data, error } = await supabase
    .from("nintei_koza_conversions")
    .update({ reward_done: done })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as NinteiKozaConversion;
}

// 紹介者の設定額と違う金額を払う場合の上書き。null を渡すと未設定に戻す。
export async function updateRewardAmount(id: string, amount: number | null) {
  const next = amount === null ? null : Math.max(0, Math.trunc(amount));
  const { data, error } = await supabase
    .from("nintei_koza_conversions")
    .update({ reward_amount: next })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as NinteiKozaConversion;
}
