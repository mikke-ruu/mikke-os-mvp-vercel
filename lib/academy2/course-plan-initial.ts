import type { Academy2Course } from './courses';
import type { SalesPlanDraftConfiguration } from './sales-plan-drafts';

/** Only the new, unsaved editor calls this. Saved revisions remain authoritative. */
export function seedNewPlanFromCourse(configuration: SalesPlanDraftConfiguration, course: Academy2Course): SalesPlanDraftConfiguration {
  if (configuration.kind !== '単品講座') return configuration;
  return { ...configuration, title: course.name, description: course.subtitle || '',
    price: course.reference_price, course_ids: [course.id] };
}
