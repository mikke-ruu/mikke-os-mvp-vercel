/** Locked Academy 2.0 capabilities. This is NOT a replacement for database checks. */
export const academy2Roles = Object.freeze(['owner', 'administrator', 'learning_operator', 'course_editor']);
const grants = Object.freeze({
  owner: ['connect.manage', 'staff.revoke', 'certification.revoke', 'license.revoke', 'finance.read', 'audit.read'],
  administrator: ['applications.read', 'applications.operate', 'payment.confirm', 'payment.refund', 'teacher_fee.pay', 'teacher_fee.edit', 'certification.confirm', 'courses.edit', 'pages.edit', 'public_price.edit', 'finance.read', 'audit.read', 'notifications.manage', 'leave.review'],
  learning_operator: ['applications.read', 'applications.operate', 'teacher_fee.edit'],
  course_editor: ['courses.edit', 'pages.edit', 'public_price.edit'],
});
export const academy2Actions = Object.freeze([...new Set(Object.values(grants).flat())]);

/** context must be derived from authenticated membership and server-loaded records. */
export function canAcademy2(role, action, context = {}) {
  if (context.sameHeadquarters !== true || !academy2Roles.includes(role)) return false;
  if (!grants[role].includes(action)) return false;
  if (role === 'learning_operator' && action === 'teacher_fee.edit') return context.assignedRequest === true;
  return true;
}

const operations = ['id', 'headquarters_id', 'course_id', 'instructor_id', 'applicant_name', 'applicant_email', 'applicant_phone', 'event_date', 'format', 'applicant_shipping_address', 'created_at'];
const finance = ['price', 'payment_status', 'payment_method', 'paid_at'];
/** Allowlist, never spread a database row. Unrelated freeform answers may contain money/contract data. */
export function filterApplicationForRole(role, row, context = {}) {
  if (!canAcademy2(role, 'applications.read', context)) return null;
  const keys = role === 'administrator' ? [...operations, ...finance] : operations;
  return Object.fromEntries(keys.filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]]));
}
