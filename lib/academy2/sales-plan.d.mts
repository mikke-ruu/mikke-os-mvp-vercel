import type { AcademyPageBlock } from '@/types/database';
import type { MonthlyPolicies } from './monthly-policy.mjs';
export type SalesPlanType = 'ワークショップ' | '単品講座' | 'コース' | '全講座' | '月額レッスン';
export const salesPlanTypes: readonly SalesPlanType[];
export const courseSteps: readonly string[];
export type CourseReference = { id: string; headquarters_id: string; title: string; description?: string; image?: string | null; reference_price: number | null; lesson_count?: number; material_count?: number; all_courses_eligible?: boolean };
export type SalesPlanApplicationField = { id: string; label: string; type: 'text' | 'textarea' | 'email' | 'tel' | 'agreement' | 'select'; required: boolean; options?: string[]; condition?: {source:'format'|'schedule_mode'|'kit_shipping'|'certificate'|'course'|'answer';value:string;field_id?:string} };
export type PlanExpiry = { kind: 'none'|'months'|'years'|'date'; count?: number|null; date?: string };
export type PlanRenewal = { enabled: boolean; conditions: string[]; other?: string; minimum_events?: number|null };
export type InstructorRegistrationFee = { enabled: boolean; amount: number|null; payment_method: 'academy_card' };
export type SalesPlan = {
  id: string; headquarters_id: string; title: string; kind: SalesPlanType; course_ids: string[]; catalog_course_ids?:string[];
  price: number | null; purchase_mode: 'all' | 'staged'; stage_prices: Record<string, number>;
  study_style: 'instructor' | 'materials_only'; allowed_methods: ('in_person' | 'online')[];
  materials: { enabled: boolean; starts?: 'from_start' | 'specified_date' | 'after_attendance'; starts_at?: string; usage?: ('learning' | 'preparation' | 'during_class' | 'review')[] };
  payment_methods: ('bank' | 'external' | 'card' | 'onsite')[]; external_payment_urls?: Record<string, string>;
  external_payment_details?: {service_name:string;instructions:string};
  after: { record_completion?: boolean; skill_certification: boolean; commercial_license: boolean; instructor_license: boolean; required_certification_id?: string; required_skill_condition_id?:string; completion_condition_id?:string; skill_definition_id?:string; commercial_condition_id?:string; instructor_condition_id?:string; instructor_manual_id?:string; instructor_registration_required?:boolean; instructor_sales_page_required?:boolean;
    manual?: {blocks:AcademyPageBlock[]}; commercial_policy?: {rights:string[];notes:string}; community_link?: {community_id:string;mapping_id:string;room_ids:string[]}; completion_timing?:'period_end'|'lesson_complete'|'hq_review';
    qualification?: {name:string;expiry:PlanExpiry;renewal:PlanRenewal};
    instructor_policy?: {rights:string[];other?:string;expiry:PlanExpiry;renewal:PlanRenewal;website_listing:boolean};
    registration_fee?: InstructorRegistrationFee;
    certificate?: { kind: 'completion' | 'certification' | 'other'; delivery: 'digital' | 'physical' | 'both'; name_rule: string } };
  dues?: { enabled: boolean; interval: 'month' | 'year'; amount: number | null; payment_method?:'academy_card'; billing_anchor?:'application'|'first'|'specified';billing_day?:number|null;cancellation?:'before_next'|'end_of_period';unpaid_grace_days?:number|null };
  opening_license?: { enabled: boolean; amount: number | null; kit: 'none' | 'included' | 'separate_order';timing?:'initial'|'per_event'|'renewal';payment_method?:'academy_card' };
  kit?: { name?: string; enabled: boolean; methods: ('shipping' | 'venue_handover')[]; recipient?: 'instructor' | 'learner' };
  community?: 'none' | 'optional' | 'required';
  monthly?: Partial<MonthlyPolicies> & { months: { month: string; course_ids: string[]; materials: boolean; kit: boolean }[];
    period: { kind: 'unlimited' } | { kind: 'months'; count: number } | { kind: 'calendar'; start: string; end: string };
    past_access: 'all_past' | 'from_join_month'; exit_policy_id?: string; certification_timing?: 'plan_completion'; completion_condition_id?: string };
  workshop?: { experience: string; description?: string; duration_minutes?: number; bring?: string; outcome?: string };
  application_form?: { fields: SalesPlanApplicationField[]; conditionalVersion?: 1 };
  terms: { version: string; body: string }; show_course_introductions: boolean;
};
export function resolvePlanCourses(plan: SalesPlan, catalog: readonly CourseReference[]): CourseReference[];
export function planPriceSummary(plan: SalesPlan, catalog: readonly CourseReference[]): { referenceTotal: number | null; saleTotal: number | null; difference: number | null; billingPeriod: 'month' | 'purchase'; discountAlert: 'threshold_not_configured' };
export function validateSalesPlan(plan: SalesPlan, catalog: readonly CourseReference[], capabilities?: { connect_ready?: boolean; recurring_ready?: boolean }): { issues: { path: string; code: string; severity: 'error' | 'hold' }[]; ready: boolean; requiresEvent: boolean };
export function deriveStandardSalesPage(plan: SalesPlan, catalog: readonly CourseReference[]): {
  plan_id: string; generated_only: true; title: string; course_introductions: { course_id: string; title: string; description: string; image: string | null }[];
  bindings: Record<'pricing' | 'events' | 'application_form' | 'terms', { source: string; id: string; source_locked: true; version?: string | null }>;
};
export function salesPlanMap(plan: SalesPlan, catalog: readonly CourseReference[]): { key: string; value: unknown; setting: string }[];


