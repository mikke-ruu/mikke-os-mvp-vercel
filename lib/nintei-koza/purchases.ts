import { supabase } from "@/lib/supabase/client";
import type { NinteiKozaChapter, NinteiKozaPurchase, NinteiKozaPurchaseRole } from "@/types/database";

// 読み間違えやすい文字（I L O 0 1）を除いた英数
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const PURCHASE_ROLE_LABELS: Record<NinteiKozaPurchaseRole, string> = {
  textbook: "完全版",
  mentoring: "個別構築"
};

/** 保存は8文字。表示は4文字ずつ区切る。 */
export function formatCode(code: string) {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function generateCode() {
  const bytes = new Uint32Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join("");
}

export async function listPurchases() {
  const { data, error } = await supabase
    .from("nintei_koza_purchases")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as NinteiKozaPurchase[];
}

export type PurchaseInput = {
  email: string | null;
  role: NinteiKozaPurchaseRole;
  issuedFor: string | null;
  note: string | null;
};

/**
 * コードを発行する。万が一ぶつかったら数回まで引き直す。
 * owner_user_id はDB既定値（所有者）が入る。
 */
export async function issuePurchaseCode(input: PurchaseInput) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();
    const { data, error } = await supabase
      .from("nintei_koza_purchases")
      .insert({
        code,
        email: input.email?.trim() || null,
        role: input.role,
        issued_for: input.issuedFor?.trim() || null,
        note: input.note?.trim() || null
      })
      .select("*")
      .single();

    if (!error) return data as NinteiKozaPurchase;
    // 23505 = 一意制約違反。コードがぶつかっただけなので引き直す。
    if (error.code !== "23505") throw error;
    lastError = error;
  }

  throw lastError instanceof Error ? lastError : new Error("コードの発行に失敗しました。もう一度お試しください。");
}

export async function setPurchaseActive(code: string, active: boolean) {
  const { data, error } = await supabase
    .from("nintei_koza_purchases")
    .update({ active })
    .eq("code", code)
    .select("*")
    .single();

  if (error) throw error;
  return data as NinteiKozaPurchase;
}

export async function updatePurchase(
  code: string,
  patch: Partial<{ email: string | null; issued_for: string | null; note: string | null }>
) {
  const { data, error } = await supabase
    .from("nintei_koza_purchases")
    .update(patch)
    .eq("code", code)
    .select("*")
    .single();

  if (error) throw error;
  return data as NinteiKozaPurchase;
}

// ---------- 教科書の本文 ----------

export async function listChapters() {
  const { data, error } = await supabase
    .from("nintei_koza_chapters")
    .select("chapter_id, title, updated_at")
    .order("chapter_id", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Pick<NinteiKozaChapter, "chapter_id" | "title" | "updated_at">[];
}

export type ChapterUpload = { chapter_id: string; title?: string; body: string };

/** strip_paid.py が出した chapters.json をそのまま流し込む。 */
export async function upsertChapters(chapters: ChapterUpload[]) {
  const rows = chapters.map((c) => ({
    chapter_id: c.chapter_id,
    title: c.title ?? null,
    body: c.body,
    updated_at: new Date().toISOString()
  }));

  const { data, error } = await supabase
    .from("nintei_koza_chapters")
    .upsert(rows, { onConflict: "chapter_id" })
    .select("chapter_id");

  if (error) throw error;
  return (data ?? []).length;
}
