import type {Academy2LearnerApplication} from './learner-operations';
export type ScheduleGroup = 'pending' | 'upcoming' | 'past';
const timestamp = (value: string | null | undefined) => value ? Date.parse(value) : NaN;
export function scheduleGroup(item: Academy2LearnerApplication, now: number): ScheduleGroup | null {
  const schedule = item.schedule;
  if (!schedule) return null;
  if (schedule.status === 'completed' || schedule.status === 'cancelled' || item.application_status === 'cancelled' || item.completed_at) return 'past';
  const start = timestamp(schedule.starts_at);
  if (!Number.isFinite(start)) return 'pending';
  const end = timestamp(schedule.ends_at);
  // When end time is unknown, a passed start is not evidence that attendance ended.
  return Number.isFinite(end) && end <= now ? 'past' : 'upcoming';
}
export function safeMeetingUrl(value: string | null | undefined): string | null {
  if (!value || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function scheduleStatus(item: Academy2LearnerApplication, now: number) {
  if (item.schedule?.status === 'cancelled' || item.application_status === 'cancelled') return '中止';
  if (item.completed_at) return '受講済み';
  const group = scheduleGroup(item, now);
  return group === 'pending' ? '日程調整中' : group === 'past' ? '終了' : '';
}

