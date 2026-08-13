-- mikke ID の検査ロジックを1箇所に集約する。
--
-- 背景:
--   予約語の判定が community_create() と story_profile_save_mine() に別々に書かれており、
--   内容が食い違っていた（Community側=38語、Story側=33語）。
--   Manager にも mikke ID 変更を追加するため、3箇所目の複製を作らずに済むよう共通化する。
--
-- 正典: docs/MIKKEOS_RESERVED_NAMES_POLICY_2026-08-04.md
--       docs/共通ルール.md §2

-- ---------------------------------------------------------------------------
-- 1. 予約スラッグの判定（Community slug / mikke ID など、公開URLになる名前の共通判定）
-- ---------------------------------------------------------------------------
create or replace function public.mikke_reserved_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_slug is null then false
    when p_slug = any (array[
      'admin', 'administrator', 'api', 'app', 'apps', 'auth', 'billing',
      'community', 'communities', 'dashboard', 'help', 'home', 'login', 'logout',
      'manager', 'member', 'members', 'mikke', 'mikke-community', 'mikke-id',
      'mikke-os', 'mikkeos', 'mikkeruu', 'official', 'official-academy',
      'official-academy-community', 'official-partner', 'official-trainer',
      'officialacademy', 'officialpartner', 'officialtrainer', 'owner',
      'profile', 'root', 'settings', 'staff', 'support', 'system'
    ]) then true
    when p_slug like 'admin-%'
      or p_slug like 'api-%'
      or p_slug like 'mikke-%'
      or p_slug like 'mikkeos-%'
      or p_slug like 'mikkeruu-%'
      or p_slug like 'official-%'
      or p_slug like 'system-%' then true
    else false
  end;
$$;

comment on function public.mikke_reserved_slug(text) is
  'mikke公式・システムに予約されたスラッグかを判定する。正典: docs/MIKKEOS_RESERVED_NAMES_POLICY_2026-08-04.md';

-- ---------------------------------------------------------------------------
-- 2. mikke ID の正規化と検査
-- ---------------------------------------------------------------------------
-- 重複検査はここで行わない。profiles_handle_unique を最終判定に使う。
-- 事前照会では同時更新の競合を防げないため（Manager室の設計案どおり）。
--
-- p_current を渡すと、
--   ・p_handle が空のときの既定値になる
--   ・正規化した結果が現在値と同じなら、予約語検査を飛ばす
-- 後者は、過去に取得した ID があとから予約語に追加された利用者を締め出さないための措置。
-- 変更しない限り、その人は今までどおり保存できる。
create or replace function public.mikke_normalize_mikke_id(
  p_handle text,
  p_current text default null
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_handle text;
begin
  v_handle := lower(trim(regexp_replace(
    coalesce(nullif(trim(p_handle), ''), p_current, ''),
    '^@', ''
  )));

  if v_handle = '' then
    raise exception 'mikke IDを入力してください。' using errcode = '22023';
  end if;

  -- 現在値のままなら、書式・予約語の検査を通さずそのまま返す
  if p_current is not null and v_handle = lower(trim(p_current)) then
    return v_handle;
  end if;

  if v_handle !~ '^[a-z0-9_][a-z0-9_-]{2,29}$' then
    raise exception 'mikke IDは半角英数字・_・- の3〜30文字で入力してください。' using errcode = '22023';
  end if;

  -- 公式・システム予約（全アプリ共通）
  if public.mikke_reserved_slug(v_handle) then
    raise exception 'このmikke IDは公式またはシステム用です。別のIDを選んでください。' using errcode = '22023';
  end if;

  -- STORYの公開URL（/story/配下）と衝突する語
  if v_handle = any (array['story', 'start', 'edit', 'new', 'preview', 'collection', 'share']) then
    raise exception 'このmikke IDは公式またはシステム用です。別のIDを選んでください。' using errcode = '22023';
  end if;

  return v_handle;
end;
$$;

comment on function public.mikke_normalize_mikke_id(text, text) is
  'mikke IDを正規化し、書式と予約語を検査して返す。重複は profiles_handle_unique に委ねる。現在値と同じ場合は検査を飛ばす。';

revoke all on function public.mikke_reserved_slug(text) from public, anon;
revoke all on function public.mikke_normalize_mikke_id(text, text) from public, anon;
grant execute on function public.mikke_reserved_slug(text) to authenticated, service_role;
grant execute on function public.mikke_normalize_mikke_id(text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
