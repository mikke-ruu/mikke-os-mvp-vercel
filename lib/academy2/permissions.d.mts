export type Academy2Role = 'owner' | 'administrator' | 'learning_operator' | 'course_editor' | 'legacy_owner';
export type Academy2Action = 'connect.manage' | 'staff.revoke' | 'certification.revoke' | 'license.revoke' | 'finance.read' | 'audit.read' | 'applications.read' | 'applications.operate' | 'payment.confirm' | 'payment.refund' | 'teacher_fee.pay' | 'teacher_fee.edit' | 'certification.confirm' | 'courses.edit' | 'pages.edit' | 'public_price.edit' | 'notifications.manage' | 'leave.review';
export interface Academy2PermissionContext { sameHeadquarters?: boolean; assignedRequest?: boolean }
export const academy2Roles: readonly Academy2Role[];
export const academy2Actions: readonly Academy2Action[];
export function canAcademy2(role: unknown, action: string, context?: Academy2PermissionContext): boolean;
export function filterApplicationForRole(role: unknown, row: Record<string, unknown>, context?: Academy2PermissionContext): Record<string, unknown> | null;
