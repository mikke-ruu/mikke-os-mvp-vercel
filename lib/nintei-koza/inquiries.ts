import { supabase } from "@/lib/supabase/client";
import type { NinteiKozaInquiry } from "@/types/database";

export const INQUIRY_STATUS_LABELS: Record<string, string> = {
  new: "未対応",
  in_progress: "対応中",
  won: "成約",
  lost: "見送り",
  closed: "完了(テスト等)"
};

export const INQUIRY_TOPIC_LABELS: Record<string, string> = {
  kobetsu: "個別構築コース",
  academy: "Academy",
  community: "Community",
  textbook: "完全版",
  other: "その他"
};

export async function listInquiries() {
  const { data, error } = await supabase
    .from("nintei_koza_inquiries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as NinteiKozaInquiry[];
}

export async function updateInquiryStatus(id: string, status: string) {
  const { data, error } = await supabase
    .from("nintei_koza_inquiries")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as NinteiKozaInquiry;
}
