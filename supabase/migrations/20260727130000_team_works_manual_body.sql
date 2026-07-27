-- Team Works W4-1: long-form manual text for partner portal section tabs.

alter table public.team_works_manuals
  add column if not exists body text;

comment on column public.team_works_manuals.body is
  'Long-form manual content shown only to HQ staff and assigned partners.';

notify pgrst, 'reload schema';
