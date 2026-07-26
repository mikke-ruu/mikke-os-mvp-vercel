-- クライアントポータルの連絡先/メッセージに担当パートナーを出すかどうかを
-- プロジェクト単位（本部の「ポータル設定」タブ）で切り替えられるようにする。
-- 業種によっては「本部のみで完結させたい」企業と「パートナーとも直接やり取りしたい」
-- 企業が混在するため、デフォルトは現行動作（両方表示）を維持する true。
alter table public.team_works_projects
  add column client_partner_contact_visible boolean not null default true;

comment on column public.team_works_projects.client_partner_contact_visible is
  'false の場合、クライアントポータルの連絡先/メッセージから担当パートナーを除外し、本部窓口のみを表示する。';

notify pgrst, 'reload schema';
