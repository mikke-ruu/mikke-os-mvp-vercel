alter table public.story_profiles
  alter column theme_key set default 'blue';

notify pgrst, 'reload schema';
