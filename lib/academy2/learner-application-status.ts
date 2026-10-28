import type { Academy2LearnerApplication } from './learner-operations';

/** Display only. Material access is always decided by the learner RPC. */
export function learnerApplicationStatus(item: Academy2LearnerApplication): string {
  if (item.application_status === 'cancelled') return 'キャンセル済み';
  if (item.application_status === 'refunded') return '返金済み';
  if (item.application_status === 'pending') return '入金確認待ち';
  if (item.application_status !== 'paid') return '申込状況をご確認ください';
  return item.completed_at || item.legacy_completed ? '修了済み' : '入金確認済み';
}

export function learnerMaterialHref(item: Academy2LearnerApplication): string | null {
  if (item.source === 'legacy_course') {
    return item.application_status === 'paid' && item.materials_available && item.course_id
      ? '/academy/h/' + encodeURIComponent(item.headquarters_id) + '/teach/study?view=learner&course=' + encodeURIComponent(item.course_id)
      : null;
  }
  return item.application_status === 'paid' && item.materials_available
    ? '/academy/portal/study?view=learner&application=' + encodeURIComponent(item.id)
    : null;
}
