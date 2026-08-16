-- mikkeOS HQ Journal Phase 1
-- Public readers only see published articles. HQ content roles manage drafts.

create table public.mikkeos_hq_article_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  color text not null default '#3f4eb5' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index mikkeos_hq_article_categories_slug_key
  on public.mikkeos_hq_article_categories (lower(slug));
create index mikkeos_hq_article_categories_order_idx
  on public.mikkeos_hq_article_categories (is_active desc, sort_order, name);
create index mikkeos_hq_article_categories_created_by_idx
  on public.mikkeos_hq_article_categories (created_by);

create table public.mikkeos_hq_articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.mikkeos_hq_article_categories(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  excerpt text not null default '' check (char_length(excerpt) <= 500),
  cover_image_url text not null default '' check (char_length(cover_image_url) <= 2048),
  cover_image_asset_id uuid references public.mikke_media_assets(id) on delete set null,
  blocks jsonb not null default '[]'::jsonb check (
    jsonb_typeof(blocks) = 'array'
    and octet_length(blocks::text) <= 524288
  ),
  is_featured boolean not null default false,
  cta_label text not null default '' check (char_length(cta_label) <= 80),
  cta_url text not null default '' check (char_length(cta_url) <= 2048),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);

create unique index mikkeos_hq_articles_slug_key
  on public.mikkeos_hq_articles (lower(slug));
create index mikkeos_hq_articles_public_idx
  on public.mikkeos_hq_articles (status, published_at desc)
  where status = 'published';
create index mikkeos_hq_articles_category_idx
  on public.mikkeos_hq_articles (category_id, published_at desc);
create index mikkeos_hq_articles_cover_asset_idx
  on public.mikkeos_hq_articles (cover_image_asset_id)
  where cover_image_asset_id is not null;
create index mikkeos_hq_articles_created_by_idx
  on public.mikkeos_hq_articles (created_by);
create index mikkeos_hq_articles_updated_by_idx
  on public.mikkeos_hq_articles (updated_by);

create or replace function public.mikkeos_hq_journal_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger mikkeos_hq_article_categories_touch_updated_at
before update on public.mikkeos_hq_article_categories
for each row execute function public.mikkeos_hq_journal_touch_updated_at();

create trigger mikkeos_hq_articles_touch_updated_at
before update on public.mikkeos_hq_articles
for each row execute function public.mikkeos_hq_journal_touch_updated_at();

revoke all on function public.mikkeos_hq_journal_touch_updated_at() from public, anon, authenticated;

alter table public.mikkeos_hq_article_categories enable row level security;
alter table public.mikkeos_hq_articles enable row level security;

create policy "Authenticated HQ staff read article categories"
on public.mikkeos_hq_article_categories for select
to authenticated
using (
  exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin', 'editor', 'analyst')
  )
);

create policy "HQ editors insert article categories"
on public.mikkeos_hq_article_categories for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin', 'editor')
  )
);

create policy "HQ editors update article categories"
on public.mikkeos_hq_article_categories for update
to authenticated
using (
  exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin', 'editor')
  )
)
with check (
  exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin', 'editor')
  )
);

create policy "Authenticated HQ staff read articles"
on public.mikkeos_hq_articles for select
to authenticated
using (
  exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin', 'editor', 'analyst')
  )
);

create policy "HQ editors insert articles"
on public.mikkeos_hq_articles for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin', 'editor')
  )
);

create policy "HQ editors update articles"
on public.mikkeos_hq_articles for update
to authenticated
using (
  exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin', 'editor')
  )
)
with check (
  updated_by = (select auth.uid())
  and exists (
    select 1 from public.mikkeos_hq_staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.is_active
      and staff.role in ('owner', 'admin', 'editor')
  )
);

revoke all on public.mikkeos_hq_article_categories, public.mikkeos_hq_articles from public, anon, authenticated;
grant select on public.mikkeos_hq_article_categories, public.mikkeos_hq_articles to authenticated;
grant insert (name, slug, color, sort_order, is_active)
  on public.mikkeos_hq_article_categories to authenticated;
grant update (name, slug, color, sort_order, is_active)
  on public.mikkeos_hq_article_categories to authenticated;
grant insert (
  category_id, slug, title, excerpt, cover_image_url, cover_image_asset_id,
  blocks, is_featured, cta_label, cta_url, status, published_at, created_by, updated_by
) on public.mikkeos_hq_articles to authenticated;
grant update (
  category_id, slug, title, excerpt, cover_image_url, cover_image_asset_id,
  blocks, is_featured, cta_label, cta_url, status, published_at, updated_by
) on public.mikkeos_hq_articles to authenticated;

create function public.mikkeos_public_journal_articles(p_limit integer default 50)
returns table (
  id uuid,
  category_id uuid,
  slug text,
  title text,
  excerpt text,
  cover_image_url text,
  blocks jsonb,
  is_featured boolean,
  cta_label text,
  cta_url text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  category_name text,
  category_slug text,
  category_color text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    article.id,
    article.category_id,
    article.slug,
    article.title,
    article.excerpt,
    article.cover_image_url,
    article.blocks,
    article.is_featured,
    article.cta_label,
    article.cta_url,
    article.published_at,
    article.created_at,
    article.updated_at,
    category.name,
    category.slug,
    category.color
  from public.mikkeos_hq_articles article
  left join public.mikkeos_hq_article_categories category
    on category.id = article.category_id
   and category.is_active
  where article.status = 'published'
    and article.published_at <= now()
  order by article.is_featured desc, article.published_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 50));
$$;

create function public.mikkeos_public_journal_article(p_slug text)
returns table (
  id uuid,
  category_id uuid,
  slug text,
  title text,
  excerpt text,
  cover_image_url text,
  blocks jsonb,
  is_featured boolean,
  cta_label text,
  cta_url text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  category_name text,
  category_slug text,
  category_color text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    article.id,
    article.category_id,
    article.slug,
    article.title,
    article.excerpt,
    article.cover_image_url,
    article.blocks,
    article.is_featured,
    article.cta_label,
    article.cta_url,
    article.published_at,
    article.created_at,
    article.updated_at,
    category.name,
    category.slug,
    category.color
  from public.mikkeos_hq_articles article
  left join public.mikkeos_hq_article_categories category
    on category.id = article.category_id
   and category.is_active
  where article.status = 'published'
    and article.published_at <= now()
    and article.slug = lower(btrim(p_slug))
  limit 1;
$$;

revoke all on function public.mikkeos_public_journal_articles(integer) from public, anon, authenticated;
revoke all on function public.mikkeos_public_journal_article(text) from public, anon, authenticated;
grant execute on function public.mikkeos_public_journal_articles(integer) to anon, authenticated;
grant execute on function public.mikkeos_public_journal_article(text) to anon, authenticated;

create rule mikkeos_hq_article_categories_audit_insert as
on insert to public.mikkeos_hq_article_categories do also
  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'insert', 'mikkeos_hq_article_categories', new.id, jsonb_build_object('slug', new.slug));

create rule mikkeos_hq_article_categories_audit_update as
on update to public.mikkeos_hq_article_categories do also
  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'update', 'mikkeos_hq_article_categories', new.id, jsonb_build_object('is_active', new.is_active));

create rule mikkeos_hq_articles_audit_insert as
on insert to public.mikkeos_hq_articles do also
  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'insert', 'mikkeos_hq_articles', new.id, jsonb_build_object('status', new.status, 'slug', new.slug));

create rule mikkeos_hq_articles_audit_update as
on update to public.mikkeos_hq_articles do also
  insert into public.mikkeos_hq_audit_logs (actor_user_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'update', 'mikkeos_hq_articles', new.id, jsonb_build_object('status', new.status, 'slug', new.slug));

comment on table public.mikkeos_hq_article_categories is
  'HQ-managed Journal categories. Used categories are hidden and restored instead of browser-deleted.';
comment on table public.mikkeos_hq_articles is
  'HQ Journal source of truth. Anonymous readers only receive published rows through narrow public RPCs.';
