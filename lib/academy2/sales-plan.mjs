import { monthlyPolicyIssues } from './monthly-policy.mjs';
// Draft 03 LOCK: existing course IDs remain content originals. No persistence or billing.
export const salesPlanTypes = Object.freeze(['ワークショップ', '単品講座', 'コース', '全講座', '月額レッスン']);
export const courseSteps = Object.freeze(['講座・順番', '受講スタイル', '金額', '支払い', '受講後', '申込フォーム', '確認・販売ページ']);
const money = n => Number.isSafeInteger(n) && n >= 0;
const text = value => typeof value === 'string' && value.trim().length > 0;
const month = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export function resolvePlanCourses(plan, catalog) {
  const own = catalog.filter(course => course.headquarters_id === plan.headquarters_id);
  // All courses uses an explicit eligibility flag from the source query, never manual checkboxes.
  const ids = plan.kind === '全講座' ? own.filter(course => course.all_courses_eligible === true).map(course => course.id)
    : plan.kind === '月額レッスン' ? [...new Set((plan.monthly?.months ?? []).flatMap(item => item.course_ids))] : plan.course_ids;
  return ids.map(id => own.find(course => course.id === id)).filter(Boolean);
}

export function planPriceSummary(plan, catalog) {
  const courses = resolvePlanCourses(plan, catalog);
  const expectedIds = plan.kind === '全講座' ? courses.map(course => course.id)
    : plan.kind === '月額レッスン' ? [...new Set((plan.monthly?.months ?? []).flatMap(item => item.course_ids))] : plan.course_ids;
  const referencesComplete = expectedIds.length === courses.length && new Set(expectedIds).size === expectedIds.length;
  const referenceKnown = referencesComplete && courses.length > 0 && courses.every(course => money(course.reference_price));
  const referenceTotal = referenceKnown ? courses.reduce((sum, course) => sum + course.reference_price, 0) : null;
  const amounts = plan.purchase_mode === 'staged' ? courses.map(course => plan.stage_prices[course.id]) : [plan.price];
  const total = (plan.purchase_mode !== 'staged' || referencesComplete) && amounts.length && amounts.every(money) ? amounts.reduce((sum, value) => sum + value, 0) : null;
  return { referenceTotal: Number.isSafeInteger(referenceTotal) ? referenceTotal : null,
    saleTotal: Number.isSafeInteger(total) ? total : null,
    difference: plan.kind !== '月額レッスン' && referenceTotal !== null && total !== null && Number.isSafeInteger(referenceTotal - total) ? referenceTotal - total : null,
    billingPeriod: plan.kind === '月額レッスン' ? 'month' : 'purchase',
    // A discount alert threshold has not been specified. Never invent a percentage.
    discountAlert: 'threshold_not_configured' };
}

export function validateSalesPlan(plan, catalog, capabilities = {}) {
  const issues = [];
  const add = (path, code, severity = 'error') => issues.push({ path, code, severity });
  if (!salesPlanTypes.includes(plan.kind)) add('kind', 'unsupported_sales_type');
  if (!text(plan.title)) add('title', 'title_required');
  if (!text(plan.headquarters_id)) add('headquarters_id', 'headquarters_required');
  const selected = resolvePlanCourses(plan, catalog);
  const originalIds = plan.kind === '月額レッスン' ? (plan.monthly?.months ?? []).flatMap(item => item.course_ids) : plan.course_ids;
  if (plan.kind !== '全講座' && originalIds.some(id => !catalog.some(course => course.id === id && course.headquarters_id === plan.headquarters_id))) add('course_ids', 'course_unavailable_or_wrong_headquarters');
  if (plan.kind !== '月額レッスン' && new Set(plan.course_ids).size !== plan.course_ids.length) add('course_ids', 'duplicate_course');
  if (plan.kind === '単品講座' && selected.length !== 1) add('course_ids', 'single_requires_one_course');
  if (plan.kind === 'コース' && selected.length < 2) add('course_ids', 'course_requires_multiple_courses');
  if (plan.kind === '全講座' && !selected.length) add('course_ids', 'no_eligible_courses');
  if (plan.kind === 'ワークショップ' && !selected.length && !text(plan.workshop?.experience)) add('workshop.experience', 'workshop_content_required');
  if (!['all', 'staged'].includes(plan.purchase_mode)) add('purchase_mode', 'purchase_mode_required');
  if (plan.purchase_mode === 'staged') {
    if (plan.kind !== 'コース') add('purchase_mode', 'staged_type_not_specified', 'hold');
    for (const course of selected) if (!money(plan.stage_prices[course.id])) add(`stage_prices.${course.id}`, 'stage_price_required');
  } else if (!money(plan.price)) add('price', 'price_required');
  if (!['instructor', 'materials_only'].includes(plan.study_style)) add('study_style', 'study_style_required');
  if (plan.study_style === 'instructor' && !plan.allowed_methods?.length) add('allowed_methods', 'teaching_method_required');
  if (plan.allowed_methods?.some(value => !['in_person', 'online'].includes(value))) add('allowed_methods', 'unsupported_teaching_method');
  if (plan.study_style === 'materials_only' && plan.materials?.enabled !== true) add('materials.enabled', 'materials_required');
  if (plan.materials?.enabled && !['from_start', 'specified_date', 'after_attendance'].includes(plan.materials.starts)) add('materials.starts', 'access_start_required');
  if (plan.study_style === 'materials_only' && plan.materials?.starts === 'after_attendance') add('materials.starts', 'attendance_not_available');
  if (plan.materials?.starts === 'specified_date' && !text(plan.materials.starts_at)) add('materials.starts_at', 'access_date_required');
  if (plan.materials?.starts === 'specified_date') add('materials.starts_at', 'access_time_policy_pending', 'hold');
  if (!plan.payment_methods?.length) add('payment_methods', 'payment_method_required');
  if (plan.payment_methods?.some(value => !['bank', 'external', 'card', 'onsite'].includes(value))) add('payment_methods', 'unsupported_payment_method');
  if (plan.payment_methods?.includes('external')) {
    const urls = plan.purchase_mode === 'staged' ? selected.map(course => [course.id, plan.external_payment_urls?.[course.id]]) : [['plan', plan.external_payment_urls?.plan]];
    for (const [key, value] of urls) { try { if (new URL(value).protocol !== 'https:') throw Error(); } catch { add(`external_payment_urls.${key}`, 'https_payment_url_required'); } }
  }
  const after = plan.after ?? {};
  if (after.certificate && (!['completion', 'certification', 'other'].includes(after.certificate.kind) || !['digital', 'physical', 'both'].includes(after.certificate.delivery) || !text(after.certificate.name_rule))) add('after.certificate', 'certificate_configuration_required');
  if ((after.commercial_license || after.instructor_license) && !after.skill_certification && !text(after.required_certification_id)) add('after', 'certification_relationship_required');
  if (after.instructor_license && capabilities.connect_ready !== true) add('after.instructor_license', 'connect_required', 'hold');
  if (plan.dues?.enabled) {
    if (!after.commercial_license && !after.instructor_license) add('dues', 'dues_right_required');
    if (!['month', 'year'].includes(plan.dues.interval) || !money(plan.dues.amount)) add('dues', 'dues_terms_required');
    if (capabilities.connect_ready !== true) add('dues', 'connect_required', 'hold');
  }
  if (plan.opening_license?.enabled && !after.instructor_license) add('opening_license', 'instructor_license_required');
  if (plan.opening_license?.enabled && !money(plan.opening_license.amount)) add('opening_license.amount', 'opening_fee_required');
  if (plan.kit?.enabled && (!plan.kit.methods?.length || plan.kit.methods.some(value => !['shipping', 'venue_handover'].includes(value)))) add('kit.methods', 'kit_delivery_method_required');
  if (plan.kit?.recipient !== undefined && !['instructor', 'learner'].includes(plan.kit.recipient)) add('kit.recipient', 'unsupported_kit_recipient');
  if (plan.kit?.enabled && plan.kit.methods?.includes('shipping') && plan.kit.recipient === undefined) add('kit.recipient', 'kit_recipient_not_selected', 'hold');
  if (plan.kind === '月額レッスン') {
    issues.push(...monthlyPolicyIssues(plan.monthly));
    const months = plan.monthly?.months ?? [];
    if (!months.length) add('monthly.months', 'one_month_required');
    if (new Set(months.map(item => item.month)).size !== months.length) add('monthly.months', 'duplicate_month');
    for (const item of months) {
      if (!month(item.month) || !item.course_ids.length || new Set(item.course_ids).size !== item.course_ids.length) add('monthly.months', 'invalid_month_courses');
    }
    if (plan.monthly?.certification_timing !== 'plan_completion' && (after.skill_certification || after.commercial_license || after.instructor_license)) add('monthly.certification_timing', 'only_plan_completion_supported');
    if ((after.skill_certification || after.commercial_license || after.instructor_license) && !text(plan.monthly?.completion_condition_id)) add('monthly.completion_condition_id', 'plan_completion_condition_required');
    const period = plan.monthly?.period;
    if (!period || !['unlimited', 'months', 'calendar'].includes(period.kind)) add('monthly.period', 'period_required');
    if (period?.kind === 'months' && (!Number.isSafeInteger(period.count) || period.count < 1)) add('monthly.period.count', 'positive_month_count_required');
    if (period?.kind === 'calendar' && (!month(period.start) || !month(period.end) || period.start > period.end)) add('monthly.period', 'invalid_calendar_period');
    if (capabilities.recurring_ready !== true) add('monthly', 'recurring_payment_not_ready', 'hold');
    if (plan.payment_methods?.length !== 1 || plan.payment_methods[0] !== 'card') add('payment_methods', 'monthly_requires_recurring_card');
    if (!['all_past', 'from_join_month'].includes(plan.monthly?.past_access)) add('monthly.past_access', 'past_access_required');
    // Store the chosen policy; do not choose cancellation/access expiry on the user's behalf.
    if (!text(plan.monthly?.exit_policy_id)) add('monthly.exit_policy_id', 'exit_policy_pending', 'hold');
  }
  if (!text(plan.terms?.version) || !text(plan.terms?.body)) add('terms', 'terms_required');
  return { issues, ready: issues.length === 0, requiresEvent: plan.study_style === 'instructor' };
}

export function deriveStandardSalesPage(plan, catalog) {
  // This is data for the existing common builder, not another builder or a publication action.
  return { plan_id: plan.id, generated_only: true, title: plan.title,
    course_introductions: plan.show_course_introductions ? resolvePlanCourses(plan, catalog).map(course => ({ course_id: course.id, title: course.title, description: course.description ?? '', image: course.image ?? null })) : [],
    bindings: { pricing: { source: 'sales_plan', id: plan.id, source_locked: true },
      events: { source: 'related_events', id: plan.id, source_locked: true },
      application_form: { source: 'sales_plan_form', id: plan.id, source_locked: true },
      terms: { source: 'sales_plan_terms', id: plan.id, version: plan.terms?.version ?? null, source_locked: true } } };
}

export function salesPlanMap(plan, catalog) {
  const courses = resolvePlanCourses(plan, catalog);
  const nodes = [{ key: 'type', value: plan.kind, setting: 'kind' }, { key: 'courses', value: courses.map(course => course.id), setting: 'course_ids' },
    { key: 'study', value: plan.study_style, setting: 'study_style' }, { key: 'pricing', value: planPriceSummary(plan, catalog), setting: 'price' }];
  for (const [key, value, setting] of [
    ['methods', plan.study_style === 'instructor' ? plan.allowed_methods : null, 'allowed_methods'],
    ['materials', plan.materials?.enabled ? plan.materials : null, 'materials'],
    ['certification', plan.after?.skill_certification || null, 'after.skill_certification'],
    ['certificate', plan.after?.certificate ?? null, 'after.certificate'],
    ['commercial_license', plan.after?.commercial_license || null, 'after.commercial_license'],
    ['instructor_license', plan.after?.instructor_license || null, 'after.instructor_license'],
    ['dues', plan.dues?.enabled ? plan.dues : null, 'dues'],
    ['opening_license', plan.opening_license?.enabled ? plan.opening_license : null, 'opening_license'],
    ['kit', plan.kit?.enabled ? plan.kit : null, 'kit'],
    ['community', plan.community && plan.community !== 'none' ? plan.community : null, 'community'],
    ['months', plan.kind === '月額レッスン' ? plan.monthly : null, 'monthly']]) {
    if (value !== null) nodes.push({ key, value: structuredClone(value), setting });
  }
  return nodes;
}

