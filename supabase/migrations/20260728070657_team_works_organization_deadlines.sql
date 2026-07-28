-- Team Works organization-level operational dates.
-- Keep the defaults compatible with the existing "25日締め" shift guidance,
-- while allowing headquarters to change the values without a code release.

alter table public.team_works_organizations
  add column if not exists shift_submission_deadline_day smallint not null default 25,
  add column if not exists other_deadline_day smallint,
  add column if not exists payment_day smallint;

alter table public.team_works_organizations
  drop constraint if exists team_works_organizations_shift_deadline_day_check,
  add constraint team_works_organizations_shift_deadline_day_check
    check (shift_submission_deadline_day between 1 and 31),
  drop constraint if exists team_works_organizations_other_deadline_day_check,
  add constraint team_works_organizations_other_deadline_day_check
    check (other_deadline_day is null or other_deadline_day between 1 and 31),
  drop constraint if exists team_works_organizations_payment_day_check,
  add constraint team_works_organizations_payment_day_check
    check (payment_day is null or payment_day between 1 and 31);

comment on column public.team_works_organizations.shift_submission_deadline_day
  is 'Day of the previous month used as the partner shift submission deadline.';
comment on column public.team_works_organizations.other_deadline_day
  is 'Optional organization-wide closing day for other submissions.';
comment on column public.team_works_organizations.payment_day
  is 'Optional organization-wide payment day.';
