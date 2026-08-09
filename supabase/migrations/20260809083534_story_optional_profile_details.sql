-- A public STORY may be a simple name card. Title and biography are optional.
-- Keep a non-empty display name requirement; new mikke profiles already receive a safe default.

alter table public.story_profiles
  drop constraint if exists story_profiles_published_required_fields;

alter table public.story_profiles
  add constraint story_profiles_published_required_fields
  check (
    publication_status = 'draft'
    or length(trim(display_name)) > 0
  );
