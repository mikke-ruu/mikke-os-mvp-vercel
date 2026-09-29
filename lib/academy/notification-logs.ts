import { supabase } from '@/lib/supabase/client';
import type { MailPayload } from './offering-mail-content.mjs';
import type { NotificationKind } from './notification-settings';

export type NotificationLog = {
  id: string; kind: NotificationKind; application_id: string | null; source_type?: string; source_id?: string; recipient_masked: string | null;
  status: 'pending' | 'sending' | 'sent' | 'review' | 'cancelled'; attempts: number; last_error: string | null;
  created_at: string; sent_at: string | null; first_attempt_at: string | null; lease_until: string | null; available_at: string;
  payload: MailPayload & { body_override?: string | null; mail_content_version?: number; template_version?: number };
};
export type NotificationLogCursor = { created_at: string; id: string; source_type?: string };
export type NotificationLogPage = { items: NotificationLog[]; next_cursor: NotificationLogCursor | null };

export async function listNotificationLogs(headquartersId: string, cursor: NotificationLogCursor | null = null): Promise<NotificationLogPage> {
  const { data, error } = await supabase.rpc('academy_list_offering_notification_logs', {
    p_headquarters_id: headquartersId, p_before_created_at: cursor?.created_at ?? null, p_before_id: cursor?.id ?? null, p_limit: 20,
    p_before_source_type: cursor?.source_type ?? null,
  }).abortSignal(AbortSignal.timeout(30000));
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') throw new Error('メールログは準備中です。');
    if (error.message?.includes('forbidden')) throw new Error('この本部のメールログを確認する権限がありません。');
    throw new Error('メールログを読み込めませんでした。もう一度お試しください。');
  }
  if (!data || !Array.isArray(data.items) || !('next_cursor' in data)) throw new Error('メールログの表示内容を確認できませんでした。');
  return data as NotificationLogPage;
}
