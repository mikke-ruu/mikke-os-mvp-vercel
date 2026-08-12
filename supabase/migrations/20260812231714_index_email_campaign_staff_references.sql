create index if not exists mikkeos_email_campaigns_created_by_idx
  on public.mikkeos_email_campaigns(created_by);

create index if not exists mikkeos_email_campaigns_last_tested_by_idx
  on public.mikkeos_email_campaigns(last_tested_by)
  where last_tested_by is not null;
