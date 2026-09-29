import { supabase } from "@/lib/supabase/client";
import { assertAcademyWritable } from "@/lib/academy/preview";

/** Receipt body only. Subject, delivery ON/OFF and dispatch are not editable here. */
export type Academy2ReceiptMailSettings = { version: number; body: string | null };
function parse(value: unknown): Academy2ReceiptMailSettings {
  const row = value as Partial<Academy2ReceiptMailSettings> | null;
  if (!row || !Number.isInteger(row.version) || (row.version ?? -1) < 0 || (row.body !== null && typeof row.body !== "string")) {
    throw new Error("申込受付メールの保存状態を確認できませんでした。");
  }
  return { version: row.version!, body: row.body };
}
function settingsError(error: { code?: string; message?: string }, saving: boolean): Error {
  const message = error.code === "42501" ? "この本部の通知メールを編集する権限がありません。"
    : error.code === "PT409" ? "別の画面で本文が更新されています。入力内容を残して、最新の保存状態を確認してください。"
    : error.message === "academy2_notification_body_too_long" ? "本文は4,000文字以内で入力してください。"
    : error.message === "academy2_notification_unknown_variable" ? "使用できない差し込み項目が含まれています。本文を確認してください。"
    : error.code === "22023" ? "本文と保存状態を確認してください。入力内容は残っています。"
    : saving ? "保存を確認できませんでした。入力内容を残して、もう一度お試しください。" : "申込受付メールを読み込めませんでした。もう一度お試しください。";
  return Object.assign(new Error(message), { code: error.code });
}
export async function getAcademy2ReceiptMailSettings(headquartersId: string): Promise<Academy2ReceiptMailSettings> {
  const { data, error } = await supabase.rpc("academy2_receipt_mail_settings", { p_headquarters_id: headquartersId }).abortSignal(AbortSignal.timeout(30_000));
  if (error) throw settingsError(error, false);
  return parse(data);
}
export async function saveAcademy2ReceiptMailSettings(headquartersId: string, expectedVersion: number, body: string | null): Promise<Academy2ReceiptMailSettings> {
  assertAcademyWritable();
  const { data, error } = await supabase.rpc("academy2_save_receipt_mail_settings", { p_headquarters_id: headquartersId, p_expected_version: expectedVersion, p_body: body }).abortSignal(AbortSignal.timeout(30_000));
  if (error) throw settingsError(error, true);
  return parse(data);
}
