-- Course-level display and workflow switches. NULL preserves the existing
-- behavior where every Academy feature is available.
alter table public.academy_courses
  add column if not exists feature_settings jsonb;

comment on column public.academy_courses.feature_settings is
  'Course-level Academy feature switches. NULL means the existing all-enabled behavior.';
