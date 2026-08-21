-- Replace PostgreSQL rewrite rules with row-level audit triggers.
-- The filename matches the migration version recorded by the production apply.
-- PostgREST wraps INSERT ... RETURNING in a data-modifying CTE, which is
-- incompatible with DO ALSO rules and prevented HQ Journal categories from
-- being created through the browser.

drop rule if exists mikkeos_hq_article_categories_audit_insert
  on public.mikkeos_hq_article_categories;
drop rule if exists mikkeos_hq_article_categories_audit_update
  on public.mikkeos_hq_article_categories;
drop rule if exists mikkeos_hq_articles_audit_insert
  on public.mikkeos_hq_articles;
drop rule if exists mikkeos_hq_articles_audit_update
  on public.mikkeos_hq_articles;

create or replace function public.mikkeos_hq_journal_write_audit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  audit_details jsonb;
begin
  if tg_table_name = 'mikkeos_hq_article_categories' then
    if tg_op = 'INSERT' then
      audit_details := jsonb_build_object('slug', new.slug);
    else
      audit_details := jsonb_build_object('is_active', new.is_active);
    end if;
  else
    audit_details := jsonb_build_object('status', new.status, 'slug', new.slug);
  end if;

  insert into public.mikkeos_hq_audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    new.id,
    audit_details
  );

  return new;
end;
$$;

revoke all on function public.mikkeos_hq_journal_write_audit()
  from public, anon, authenticated;

drop trigger if exists mikkeos_hq_article_categories_audit_insert
  on public.mikkeos_hq_article_categories;
create trigger mikkeos_hq_article_categories_audit_insert
after insert on public.mikkeos_hq_article_categories
for each row execute function public.mikkeos_hq_journal_write_audit();

drop trigger if exists mikkeos_hq_article_categories_audit_update
  on public.mikkeos_hq_article_categories;
create trigger mikkeos_hq_article_categories_audit_update
after update on public.mikkeos_hq_article_categories
for each row execute function public.mikkeos_hq_journal_write_audit();

drop trigger if exists mikkeos_hq_articles_audit_insert
  on public.mikkeos_hq_articles;
create trigger mikkeos_hq_articles_audit_insert
after insert on public.mikkeos_hq_articles
for each row execute function public.mikkeos_hq_journal_write_audit();

drop trigger if exists mikkeos_hq_articles_audit_update
  on public.mikkeos_hq_articles;
create trigger mikkeos_hq_articles_audit_update
after update on public.mikkeos_hq_articles
for each row execute function public.mikkeos_hq_journal_write_audit();
