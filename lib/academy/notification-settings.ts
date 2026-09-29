import { supabase } from '@/lib/supabase/client';
import { MAIL_KINDS, type MailKind } from './offering-mail-content.mjs';

export type NotificationKind = MailKind;
export type NotificationBodies = Record<NotificationKind, string | null>;
export type NotificationSettings = { version: number; bodies: NotificationBodies };

function parseSettings(value: unknown): NotificationSettings {
  const data = value as Partial<NotificationSettings> | null;
  if (!data || !Number.isInteger(data.version) || (data.version ?? -1) < 0 || !data.bodies ||
      !MAIL_KINDS.every(kind => data.bodies![kind] === null || typeof data.bodies![kind] === 'string')) {
    throw new Error('メール本文の保存状態を確認できませんでした。再読み込みしてください。');
  }
  return data as NotificationSettings;
}

function settingsError(error: { code?: string; message?: string }): Error {
  if (error.code === 'PGRST202' || error.code === '42883') return new Error('メール本文の設定は準備中です。');
  if (error.message?.includes('stale') || error.message?.includes('conflict')) return new Error('別の画面で本文が更新されています。入力した文章を控えてから、保存済みの本文を読み直してください。');
  if (error.message?.includes('forbidden')) return new Error('この本部のメール本文を変更する権限がありません。');
  if (error.message?.includes('read_only')) return new Error('現在の利用状態ではメール本文を変更できません。本部の利用状態を確認してください。');
  if (error.message?.includes('invalid') || error.message?.includes('too_long') || error.message?.includes('unknown_variable')) return new Error('本文の長さと差し込み項目を確認してください。');
  return new Error('保存状態を確認できませんでした。入力した文章を控えてから、保存済みの本文を読み直してください。');
}

export async function getNotificationSettings(headquartersId: string): Promise<NotificationSettings> {
  const { data, error } = await supabase.rpc('academy_get_offering_mail_settings', { p_headquarters_id: headquartersId }).abortSignal(AbortSignal.timeout(30000));
  if (error) throw settingsError(error);
  return parseSettings(data);
}

export async function saveNotificationSettings(headquartersId: string, settings: NotificationSettings): Promise<NotificationSettings> {
  const { data, error } = await supabase.rpc('academy_save_offering_mail_settings', {
    p_headquarters_id: headquartersId, p_version: settings.version, p_bodies: settings.bodies,
  }).abortSignal(AbortSignal.timeout(30000));
  if (error) throw settingsError(error);
  return parseSettings(data);
}
