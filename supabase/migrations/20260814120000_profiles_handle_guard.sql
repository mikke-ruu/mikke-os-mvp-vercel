-- mikke IDの検査を profiles テーブル側へ集約し、本番の実物をリポジトリへ取り込む。
--
-- 経緯:
--   2026-08-14に story_profile_save_mine() の予約語検査を共通関数へ差し替えようとしたところ、
--   本番で稼働していたのは引数19個版（p_website_label / p_shop_label を含む）で、
--   migrationに残っていた引数17個版とは別物だった。
--   17個版を create or replace した結果、上書きではなく2つ目の関数が増え、
--   PostgRESTが呼び先を決められずSTORYのプロフィール保存が停止した（PGRST203）。
--
--   19個版は Supabase の画面で直接作られており、migrationファイルが存在しなかった。
--   リポジトリだけを見ても現物が分からない状態だった。
--
-- 対策は3段構え:
--   1. 事故で増えた17個版を削除する
--   2. profiles.handle に入る値を、経路に関係なく共通関数へ通すトリガーを置く
--   3. 本番で動いている19個版をそのままリポジトリへ取り込み、検査だけ共通関数へ寄せる

-- ---------------------------------------------------------------------------
-- 1. 事故で増えた17個版の削除（本番では2026-08-14に手動適用済み。冪等）
-- ---------------------------------------------------------------------------
drop function if exists public.story_profile_save_mine(
  text, text, text, text, text, text, text, text, jsonb, text,
  text, text, jsonb, text[], text, text, text
);

-- ---------------------------------------------------------------------------
-- 2. profiles.handle の検査トリガー（経路に関係なく効く防御）
-- ---------------------------------------------------------------------------
-- ・INSERT: 値があるときだけ検査する（自動採番の user_xxxx はそのまま通る）
-- ・UPDATE: 値が変わるときだけ検査する
--   → 過去に取得したIDが後から予約語に追加された利用者を締め出さない
create or replace function public.profiles_guard_handle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.handle is not null and btrim(new.handle) <> '' then
      new.handle := public.mikke_normalize_mikke_id(new.handle, null);
    end if;
    return new;
  end if;

  if new.handle is distinct from old.handle then
    new.handle := public.mikke_normalize_mikke_id(new.handle, old.handle);
  end if;

  return new;
end;
$$;

comment on function public.profiles_guard_handle() is
  'profiles.handle に入る値を、経路に関係なく mikke_normalize_mikke_id で検査・正規化する。';

revoke all on function public.profiles_guard_handle() from public, anon, authenticated;
grant execute on function public.profiles_guard_handle() to postgres, service_role;

drop trigger if exists profiles_guard_handle on public.profiles;
create trigger profiles_guard_handle
before insert or update of handle on public.profiles
for each row execute function public.profiles_guard_handle();

-- ---------------------------------------------------------------------------
-- 3. 本番で稼働中の story_profile_save_mine（引数19個）をリポジトリへ取り込む
-- ---------------------------------------------------------------------------
-- 本番から pg_get_functiondef() で書き出した定義をそのまま採用し、
-- 変更したのは mikke ID の正規化・書式・予約語の3ブロックを
-- public.mikke_normalize_mikke_id() の呼び出し1行へ置き換えた箇所のみ。
create or replace function public.story_profile_save_mine(
  p_handle text,
  p_display_name text,
  p_role_label text default ''::text,
  p_bio text default ''::text,
  p_area text default ''::text,
  p_avatar_url text default null::text,
  p_avatar_storage_path text default null::text,
  p_banner_storage_path text default null::text,
  p_portfolio_items jsonb default '[]'::jsonb,
  p_theme_key text default 'blue'::text,
  p_website_label text default 'Webサイト'::text,
  p_website_url text default null::text,
  p_shop_label text default 'ショップ'::text,
  p_shop_url text default null::text,
  p_sns_links jsonb default '[]'::jsonb,
  p_tags text[] default '{}'::text[],
  p_status_label text default ''::text,
  p_pickup_text text default ''::text,
  p_publication_status text default 'draft'::text
)
returns table(
  handle text, display_name text, role_label text, bio text, area text,
  avatar_url text, avatar_storage_path text, banner_storage_path text,
  portfolio_items jsonb, theme_key text,
  website_label text, website_url text, shop_label text, shop_url text,
  sns_links jsonb, tags text[], status_label text, pickup_text text,
  publication_status text, published_at timestamptz, created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid := (select auth.uid());
  caller_profile_id uuid;
  current_handle text;
  requested_handle text;
begin
  if caller_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_publication_status not in ('draft', 'published') then
    raise exception 'Invalid publication status.' using errcode = '22023';
  end if;
  if p_theme_key not in ('blue', 'orange', 'green', 'yellow', 'pink') then
    raise exception 'Invalid theme.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_portfolio_items, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_portfolio_items, '[]'::jsonb)) > 6 then
    raise exception 'Portfolio must be an array of at most six items.' using errcode = '22023';
  end if;

  select p.id, p.handle into caller_profile_id, current_handle
  from public.profiles p
  where p.user_id = caller_user_id
  order by p.created_at asc
  limit 1;
  if caller_profile_id is null then
    raise exception 'Profile not found for authenticated user.' using errcode = 'P0002';
  end if;

  -- ここだけが変更点。旧: 正規化＋書式検査＋33語の予約語リストを直書き
  requested_handle := public.mikke_normalize_mikke_id(p_handle, current_handle);

  if requested_handle is distinct from current_handle then
    update public.profiles
    set handle = requested_handle,
        updated_at = now()
    where id = caller_profile_id
      and user_id = caller_user_id;
  end if;

  insert into public.story_profiles as sp (
    owner_user_id, owner_profile_id, handle, display_name, role_label, bio, area,
    avatar_url, avatar_storage_path, banner_storage_path, portfolio_items, theme_key,
    website_label, website_url, shop_label, shop_url, sns_links, tags, status_label, pickup_text,
    publication_status, published_at
  ) values (
    caller_user_id, caller_profile_id, requested_handle, trim(p_display_name), trim(p_role_label),
    trim(p_bio), trim(p_area), nullif(trim(p_avatar_url), ''), nullif(trim(p_avatar_storage_path), ''),
    nullif(trim(p_banner_storage_path), ''), coalesce(p_portfolio_items, '[]'::jsonb), p_theme_key,
    coalesce(nullif(trim(p_website_label), ''), 'Webサイト'), nullif(trim(p_website_url), ''),
    coalesce(nullif(trim(p_shop_label), ''), 'ショップ'), nullif(trim(p_shop_url), ''),
    coalesce(p_sns_links, '[]'::jsonb), coalesce(p_tags, '{}'::text[]),
    trim(p_status_label), trim(p_pickup_text), p_publication_status,
    case when p_publication_status = 'published' then now() else null end
  )
  on conflict (owner_profile_id) do update set
    handle = excluded.handle, display_name = excluded.display_name, role_label = excluded.role_label,
    bio = excluded.bio, area = excluded.area, avatar_url = excluded.avatar_url,
    avatar_storage_path = excluded.avatar_storage_path, banner_storage_path = excluded.banner_storage_path,
    portfolio_items = excluded.portfolio_items, theme_key = excluded.theme_key,
    website_label = excluded.website_label, website_url = excluded.website_url,
    shop_label = excluded.shop_label, shop_url = excluded.shop_url, sns_links = excluded.sns_links,
    tags = excluded.tags, status_label = excluded.status_label, pickup_text = excluded.pickup_text,
    publication_status = excluded.publication_status,
    published_at = case when excluded.publication_status = 'published' then coalesce(sp.published_at, now()) else null end,
    updated_at = now()
  where sp.owner_user_id = caller_user_id;

  return query
  select sp.handle, sp.display_name, sp.role_label, sp.bio, sp.area,
    sp.avatar_url, sp.avatar_storage_path, sp.banner_storage_path,
    sp.portfolio_items, sp.theme_key,
    sp.website_label, sp.website_url, sp.shop_label, sp.shop_url,
    sp.sns_links, sp.tags, sp.status_label, sp.pickup_text,
    sp.publication_status, sp.published_at, sp.created_at, sp.updated_at
  from public.story_profiles sp
  where sp.owner_user_id = caller_user_id
  limit 1;
end;
$$;

revoke all on function public.story_profile_save_mine(
  text, text, text, text, text, text, text, text, jsonb, text,
  text, text, text, text, jsonb, text[], text, text, text
) from public, anon;
grant execute on function public.story_profile_save_mine(
  text, text, text, text, text, text, text, text, jsonb, text,
  text, text, text, text, jsonb, text[], text, text, text
) to authenticated, service_role;

notify pgrst, 'reload schema';

-- 適用後の確認: story_profile_save_mine が1つだけであること
select p.oid::regprocedure as signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'story_profile_save_mine';
