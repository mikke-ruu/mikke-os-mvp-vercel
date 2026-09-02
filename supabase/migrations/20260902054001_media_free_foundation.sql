create table public.media_sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 80),
  description text not null default '' check (char_length(description) <= 500),
  author_name text not null check (char_length(btrim(author_name)) between 1 and 120),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id),
  unique (id, owner_id)
);

create table public.media_categories (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.media_sites(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 80),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug),
  unique (site_id, id)
);

create table public.media_articles (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.media_sites(id) on delete cascade,
  category_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 100),
  excerpt text not null default '' check (char_length(excerpt) <= 500),
  cover_image_url text not null default '' check (char_length(cover_image_url) <= 2048),
  cover_image_asset_id uuid references public.mikke_media_assets(id) on delete set null,
  draft_blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(draft_blocks) = 'array'),
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  current_published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug),
  foreign key (site_id, category_id) references public.media_categories(site_id, id)
);

create table public.media_article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.media_articles(id) on delete cascade,
  site_id uuid not null references public.media_sites(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  title text not null,
  slug text not null,
  excerpt text not null default '',
  category_name text not null default '',
  cover_image_url text not null default '',
  blocks jsonb not null check (jsonb_typeof(blocks) = 'array'),
  published_at timestamptz not null default now(),
  unique (article_id, version_number),
  unique (article_id, id)
);

alter table public.media_articles
  add constraint media_articles_current_version_fk
  foreign key (id, current_published_version_id)
  references public.media_article_versions(article_id, id);

create index media_sites_owner_id_idx on public.media_sites(owner_id);
create index media_categories_site_id_idx on public.media_categories(site_id);
create index media_articles_site_id_idx on public.media_articles(site_id);
create index media_articles_category_id_idx on public.media_articles(category_id);
create index media_article_versions_site_id_idx on public.media_article_versions(site_id);
create index media_article_versions_article_id_idx on public.media_article_versions(article_id);

alter table public.media_sites enable row level security;
alter table public.media_categories enable row level security;
alter table public.media_articles enable row level security;
alter table public.media_article_versions enable row level security;

revoke all on table public.media_sites, public.media_categories, public.media_articles, public.media_article_versions from anon, authenticated;
grant select, insert, update, delete on table public.media_sites, public.media_categories, public.media_articles to authenticated;
grant select on table public.media_article_versions to authenticated;

create policy "media owners select sites" on public.media_sites for select to authenticated
using ((select auth.uid()) = owner_id);
create policy "media owners insert sites" on public.media_sites for insert to authenticated
with check ((select auth.uid()) = owner_id);
create policy "media owners update sites" on public.media_sites for update to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "media owners delete sites" on public.media_sites for delete to authenticated
using ((select auth.uid()) = owner_id);

create policy "media owners select categories" on public.media_categories for select to authenticated
using (exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "media owners insert categories" on public.media_categories for insert to authenticated
with check (exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "media owners update categories" on public.media_categories for update to authenticated
using (exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())))
with check (exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "media owners delete categories" on public.media_categories for delete to authenticated
using (exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())));

create policy "media owners select articles" on public.media_articles for select to authenticated
using (exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "media owners insert articles" on public.media_articles for insert to authenticated
with check (exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "media owners update articles" on public.media_articles for update to authenticated
using (exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())))
with check (exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy "media owners delete articles" on public.media_articles for delete to authenticated
using (exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())));

create policy "media owners select versions" on public.media_article_versions for select to authenticated
using (exists (select 1 from public.media_sites s where s.id = site_id and s.owner_id = (select auth.uid())));

create or replace function public.media_publish_article(p_article_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_article public.media_articles%rowtype;
  v_version_id uuid;
  v_version_number integer;
  v_category_name text := '';
begin
  if (select auth.uid()) is null then raise exception 'MEDIA_AUTH_REQUIRED'; end if;
  select a.* into v_article
  from public.media_articles a
  join public.media_sites s on s.id = a.site_id
  where a.id = p_article_id and s.owner_id = (select auth.uid())
  for update of a;
  if not found then raise exception 'MEDIA_ARTICLE_NOT_AVAILABLE'; end if;
  if v_article.category_id is not null then
    select c.name into v_category_name from public.media_categories c where c.id = v_article.category_id and c.site_id = v_article.site_id;
  end if;
  select coalesce(max(v.version_number), 0) + 1 into v_version_number from public.media_article_versions v where v.article_id = v_article.id;
  insert into public.media_article_versions (article_id, site_id, version_number, title, slug, excerpt, category_name, cover_image_url, blocks)
  values (v_article.id, v_article.site_id, v_version_number, v_article.title, v_article.slug, v_article.excerpt, coalesce(v_category_name, ''), v_article.cover_image_url, v_article.draft_blocks)
  returning id into v_version_id;
  update public.media_articles set status = 'published', current_published_version_id = v_version_id, updated_at = now() where id = v_article.id;
  update public.media_sites set is_published = true, updated_at = now() where id = v_article.site_id;
  return v_version_id;
end;
$$;

create or replace function public.media_unpublish_article(p_article_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_site_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'MEDIA_AUTH_REQUIRED'; end if;
  select a.site_id into v_site_id from public.media_articles a join public.media_sites s on s.id = a.site_id
  where a.id = p_article_id and s.owner_id = (select auth.uid()) for update of a;
  if not found then raise exception 'MEDIA_ARTICLE_NOT_AVAILABLE'; end if;
  update public.media_articles set status = 'unpublished', current_published_version_id = null, updated_at = now() where id = p_article_id;
  update public.media_sites s set is_published = exists (
    select 1 from public.media_articles a where a.site_id = v_site_id and a.status = 'published' and a.current_published_version_id is not null
  ), updated_at = now() where s.id = v_site_id;
end;
$$;

create or replace function public.media_public_site(p_slug text)
returns table (id uuid, name text, slug text, description text, author_name text, categories jsonb)
language sql stable security definer set search_path = '' as $$
  select s.id, s.name, s.slug, s.description, s.author_name,
    coalesce((select jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug) order by c.sort_order, c.name) from public.media_categories c where c.site_id = s.id), '[]'::jsonb)
  from public.media_sites s where s.slug = p_slug and s.is_published = true;
$$;

create or replace function public.media_public_articles(p_site_slug text, p_limit integer default 50)
returns table (id uuid, title text, slug text, excerpt text, category_name text, cover_image_url text, blocks jsonb, published_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id, v.title, v.slug, v.excerpt, v.category_name, v.cover_image_url, v.blocks, v.published_at, v.published_at
  from public.media_sites s join public.media_articles a on a.site_id = s.id join public.media_article_versions v on v.id = a.current_published_version_id and v.article_id = a.id
  where s.slug = p_site_slug and s.is_published = true and a.status = 'published'
  order by v.published_at desc limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

create or replace function public.media_public_article(p_site_slug text, p_article_slug text)
returns table (id uuid, title text, slug text, excerpt text, category_name text, cover_image_url text, blocks jsonb, published_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id, v.title, v.slug, v.excerpt, v.category_name, v.cover_image_url, v.blocks, v.published_at, v.published_at
  from public.media_sites s join public.media_articles a on a.site_id = s.id join public.media_article_versions v on v.id = a.current_published_version_id and v.article_id = a.id
  where s.slug = p_site_slug and v.slug = p_article_slug and s.is_published = true and a.status = 'published' limit 1;
$$;

revoke execute on function public.media_publish_article(uuid), public.media_unpublish_article(uuid), public.media_public_site(text), public.media_public_articles(text, integer), public.media_public_article(text, text) from public, anon, authenticated;
grant execute on function public.media_publish_article(uuid), public.media_unpublish_article(uuid) to authenticated;
grant execute on function public.media_public_site(text), public.media_public_articles(text, integer), public.media_public_article(text, text) to anon, authenticated;
