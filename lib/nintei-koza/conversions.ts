import { supabase } from "@/lib/supabase/client";
import type { NinteiKozaConversion, NinteiKozaProduct, NinteiKozaReferrer } from "@/types/database";

export const PRODUCT_LABELS: Record<NinteiKozaProduct, string> = {
  textbook: "完全版",
  kobetsu: "個別構築コース",
  academy: "Academy",
  community: "Community"
};

// お礼対象かどうかを判定(完全版/個別構築のみ、かつ紹介者がその商品を対象にしているか)
export function calcRewardDue(product: NinteiKozaProduct, referral: string | null, referrers: NinteiKozaReferrer[]): boolean {
  if (!referral) return false;
  if (product !== "textbook" && product !== "kobetsu") return false;
  const r = referrers.find((x) => x.code === referral && x.active);
  if (!r) return false;
  return product === "textbook" ? r.reward_textbook : r.reward_kobetsu;
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
  const { data, error } = await supabase
    .from("nintei_koza_conversions")
    .insert({
      inquiry_id: input.inquiryId,
      product: input.product,
      amount: input.amount,
      referral: input.referral,
      reward_due,
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
