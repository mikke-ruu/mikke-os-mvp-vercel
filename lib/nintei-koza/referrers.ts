import { supabase } from "@/lib/supabase/client";
import type { NinteiKozaReferrer } from "@/types/database";

const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{1,31}$/;

// 紹介リンクの土台。コードは ?r= に載せる。
export const REFERRAL_LINK_BASE = "https://joesstylea-svg.github.io/nintei-koza-site/";

export function buildReferralLink(code: string) {
  return `${REFERRAL_LINK_BASE}?r=${code}`;
}

export async function listReferrers() {
  const { data, error } = await supabase
    .from("nintei_koza_referrers")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as NinteiKozaReferrer[];
}

export type ReferrerInput = {
  code: string;
  name: string;
  kind: "member" | "buyer" | "other";
  rewardTextbook: boolean;
  rewardKobetsu: boolean;
  rewardTextbookAmount: number;
  rewardKobetsuAmount: number;
  note: string | null;
};

export function isValidReferrerCode(code: string) {
  return CODE_PATTERN.test(code);
}

export async function createReferrer(input: ReferrerInput) {
  const code = input.code.trim().toLowerCase();
  if (!isValidReferrerCode(code)) {
    throw new Error("コードは小文字英数字とハイフンのみ、2〜32文字で入力してください。");
  }
  // owner_user_id はDB既定値の auth.uid() が入る（RLSの with check と一致する）
  const { data, error } = await supabase
    .from("nintei_koza_referrers")
    .insert({
      code,
      name: input.name.trim(),
      kind: input.kind,
      reward_textbook: input.rewardTextbook,
      reward_kobetsu: input.rewardKobetsu,
      reward_textbook_amount: Math.max(0, Math.trunc(input.rewardTextbookAmount)),
      reward_kobetsu_amount: Math.max(0, Math.trunc(input.rewardKobetsuAmount)),
      note: input.note
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as NinteiKozaReferrer;
}

export type ReferrerPatch = Partial<{
  name: string;
  kind: "member" | "buyer" | "other";
  active: boolean;
  reward_textbook: boolean;
  reward_kobetsu: boolean;
  reward_textbook_amount: number;
  reward_kobetsu_amount: number;
  note: string | null;
}>;

export async function updateReferrer(code: string, patch: ReferrerPatch) {
  const { data, error } = await supabase
    .from("nintei_koza_referrers")
    .update(patch)
    .eq("code", code)
    .select("*")
    .single();

  if (error) throw error;
  return data as NinteiKozaReferrer;
}
