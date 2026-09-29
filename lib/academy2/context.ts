import { supabase } from '@/lib/supabase/client';
import { academy2Roles, type Academy2Role } from './permissions.mjs';

export type Academy2HeadquartersContext = { id: string; name: string; handle: string; role: Academy2Role };
export async function listAcademy2Headquarters(): Promise<Academy2HeadquartersContext[]> {
  const { data, error } = await supabase.rpc('academy2_my_headquarters');
  // An installation without the additive migration remains on its legacy path.
  if (error?.code === 'PGRST202' || error?.code === '42883') return [];
  if (error) throw new Error('本部の権限を確認できませんでした。もう一度お試しください。');
  if (!Array.isArray(data) || data.some(row => !row || typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.handle !== 'string' || !academy2Roles.includes(row.role))) throw new Error('本部の情報を確認できませんでした。');
  return data.map(({ id, name, handle, role }) => ({ id, name, handle, role }));
}

export type InstructorActivityContext = { id: string; name: string; handle: string; activity_id: string };

export async function loadInstructorActivityContext(activityId: string): Promise<InstructorActivityContext> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activityId)) {
    throw new Error('活動・契約の情報が見つかりませんでした。');
  }
  const { data, error } = await supabase.rpc('academy2_activity_shell_context', { p_activity_id: activityId });
  if (error) {
    if (error.code === '42501') throw new Error('この活動情報を確認する権限がありません。');
    throw new Error('活動・契約を読み込めませんでした。もう一度お試しください。');
  }
  if (!data || data.activity_id !== activityId || typeof data.id !== 'string' || typeof data.name !== 'string' || typeof data.handle !== 'string') {
    throw new Error('活動・契約の情報を確認できませんでした。');
  }
  return { id: data.id, name: data.name, handle: data.handle, activity_id: data.activity_id };
}
