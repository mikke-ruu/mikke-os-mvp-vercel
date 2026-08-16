import type {
  AcademyCourse,
  AcademyCourseFeatureSettings,
  AcademyCoursePortalFeatureSettings
} from "@/types/database";

export const DEFAULT_ACADEMY_COURSE_PORTAL_FEATURE_SETTINGS: AcademyCoursePortalFeatureSettings = {
  learning: true,
  applications: true,
  classes: true,
  approvals: true,
  kits: true,
  procurement: true,
  credentials: true,
  subscription: true
};

export const DEFAULT_ACADEMY_COURSE_FEATURE_SETTINGS: AcademyCourseFeatureSettings = {
  stepLearning: true,
  materialLicenses: true,
  materialAssignments: true,
  applications: true,
  classes: true,
  kits: true,
  certification: true,
  renewal: true,
  subscriptions: true,
  publicCoursePage: true,
  portal: DEFAULT_ACADEMY_COURSE_PORTAL_FEATURE_SETTINGS
};

export function resolveAcademyCourseFeatureSettings(
  overrides: Partial<AcademyCourseFeatureSettings> | null | undefined
): AcademyCourseFeatureSettings {
  const resolved: AcademyCourseFeatureSettings = {
    ...DEFAULT_ACADEMY_COURSE_FEATURE_SETTINGS,
    ...(overrides ?? {}),
    portal: {
      ...DEFAULT_ACADEMY_COURSE_PORTAL_FEATURE_SETTINGS,
      ...(overrides?.portal ?? {})
    }
  };

  if (!resolved.stepLearning) resolved.portal.learning = false;
  if (!resolved.applications) resolved.portal.applications = false;
  if (!resolved.classes) resolved.portal.classes = false;
  if (!resolved.kits) {
    resolved.portal.kits = false;
    resolved.portal.procurement = false;
  }
  if (!resolved.certification) {
    resolved.renewal = false;
    resolved.portal.credentials = false;
  }
  if (!resolved.subscriptions) resolved.portal.subscription = false;

  return resolved;
}

export function resolveAcademyCourseFeaturesForCourse(course: AcademyCourse) {
  return resolveAcademyCourseFeatureSettings({
    ...course.feature_settings,
    kits: course.feature_settings?.kits ?? course.requires_kit ?? true
  });
}
