create table public.mikkeos_implementation_projects (
  id uuid primary key default gen_random_uuid(),
  app_key text not null unique check (app_key ~ '^[a-z0-9-]+$'),
  app_name text not null check (char_length(trim(app_name)) between 1 and 80),
  summary text not null default '',
  status text not null default 'planning' check (status in ('planning', 'active', 'waiting', 'release_waiting', 'completed', 'paused')),
  phase text not null default '',
  current_focus text not null default '',
  public_state text not null default 'not_public' check (public_state in ('not_public', 'internal', 'partial', 'public')),
  verify_path text not null default '',
  verification_note text not null default '',
  branch_ref text not null default '',
  sort_order integer not null default 100,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mikkeos_implementation_gates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.mikkeos_implementation_projects(id) on delete cascade,
  gate_key text not null check (gate_key in ('product', 'ui', 'feature', 'shared', 'auth', 'database', 'billing', 'legal', 'checks', 'git', 'deployment', 'production', 'homepage', 'promotion', 'operations')),
  status text not null default 'not_started' check (status in ('not_applicable', 'not_started', 'in_progress', 'blocked', 'verified')),
  summary text not null default '',
  evidence_ref text not null default '',
  verified_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, gate_key)
);

create table public.mikkeos_implementation_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.mikkeos_implementation_projects(id) on delete set null,
  item_type text not null check (item_type in ('consultation', 'approval', 'result', 'note')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_user', 'approved', 'rejected', 'completed', 'archived')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  title text not null check (char_length(trim(title)) between 1 and 160),
  body text not null default '',
  question text not null default '',
  result text not null default '',
  evidence_ref text not null default '',
  task_ref text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mikkeos_implementation_projects_status_idx on public.mikkeos_implementation_projects(status, sort_order);
create index mikkeos_implementation_items_status_idx on public.mikkeos_implementation_items(status, created_at desc);
create index mikkeos_implementation_items_project_idx on public.mikkeos_implementation_items(project_id, created_at desc);

alter table public.mikkeos_implementation_projects enable row level security;
alter table public.mikkeos_implementation_gates enable row level security;
alter table public.mikkeos_implementation_items enable row level security;

create policy "HQ owners manage implementation projects"
on public.mikkeos_implementation_projects for all to authenticated
using (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin')
))
with check (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin')
));

create policy "HQ owners manage implementation gates"
on public.mikkeos_implementation_gates for all to authenticated
using (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin')
))
with check (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin')
));

create policy "HQ owners manage implementation items"
on public.mikkeos_implementation_items for all to authenticated
using (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin')
))
with check (exists (
  select 1 from public.mikkeos_hq_staff_members staff
  where staff.user_id = (select auth.uid()) and staff.is_active and staff.role in ('owner', 'admin')
));

revoke all on public.mikkeos_implementation_projects, public.mikkeos_implementation_gates, public.mikkeos_implementation_items from public, anon;
grant select, insert, update on public.mikkeos_implementation_projects, public.mikkeos_implementation_gates, public.mikkeos_implementation_items to authenticated;

insert into public.mikkeos_implementation_projects
  (app_key, app_name, summary, status, phase, current_focus, public_state, verify_path, verification_note, branch_ref, sort_order)
values
  ('academy', 'Academy', '講座運営・講師・受講者のワークスペース', 'active', '継続実装', 'クラス日程と講師依頼フロー', 'partial', '/academy', '現行版は確認可能。新機能はまだmaster未反映。', 'codex/academy-release-20260815', 10),
  ('marketnote', 'MarketNote', '予定・活動・振り返りを繋ぐノート', 'active', '継続実装', 'イベント種類ごとの自動サマリー設定', 'public', '/marketnote', '現行版は公開中。自動サマリーv2はまだmaster未反映。', 'codex/marketnote-auto-summary-v2', 20),
  ('community', 'Community', 'コミュニティの参加・運営・安全管理', 'waiting', '回収・確認待ち', 'UI polishと公開ゲートの分離', 'partial', '/apps/community', '限定確認は可能。有料・一般公開は未承認。', 'codex/community-platform-plans', 30),
  ('story', 'STORY', '公開プロフィールと活動ストーリー', 'active', '公開導線整備', '公開プロフィールと入力安全性', 'public', '/story', '現行版は公開中。古いdraft PRは競合中。', '', 40),
  ('manager', 'Manager', '個人の予定・履歴・タスク統合', 'active', 'データ統合', 'Activity Logの実データ化', 'public', '/manager', '現行版は公開中。一部はモック/localStorage。', '', 50),
  ('team-works', 'Team Works', 'チーム業務・顧客・納品管理', 'waiting', '確認・統合', '運用フローと権限境界の確認', 'partial', '/apps/team-works', '実装済み範囲の公開状態を再確認する。', '', 60),
  ('library', 'Library', '資料・画像・コンテンツ保管', 'waiting', '公開確認', 'ストレージ権限と本番ルート確認', 'partial', '/apps/library', 'ルートと認証後の動作確認が必要。', '', 70),
  ('page', 'Page', 'ホームページ・LP作成', 'waiting', '統合確認', 'エディタと公開導線', 'partial', '/apps/page', '現行版の保存境界と公開導線の確認が必要。', '', 80),
  ('fund', 'Fund', '支援・先行販売・プロジェクト運営', 'planning', '試作', '決済・返金・履行責任の商品境界', 'not_public', '/apps/fund', '管理・公開候補ルートはあるが、一般公開は未承認。', '', 90),
  ('event', 'Event', 'イベント募集・申込み管理', 'planning', '試作', '商品境界、申込みメール、権限の確認', 'not_public', '/apps/event', '直接ルートはあるが、公開対象ではない。', '', 100),
  ('order', 'Order', '受注・見積・納品管理', 'planning', '試作', '支払い・契約・返金・納品運用', 'not_public', '/apps/order', '直接ルートはあるが、公開対象ではない。', '', 110),
  ('session', 'Session', '予約・セッション運営', 'planning', '試作', '予約変更・キャンセル・決済・メール', 'not_public', '/apps/session', '直接ルートはあるが、公開対象ではない。', '', 120),
  ('item-studio', 'Item Studio', '商品・アイテム作成と管理', 'planning', '試作', '実データ、所有判定、STORY連携の本人確認', 'not_public', '/apps/item-studio', '直接ルートはあるが、公開対象ではない。', '', 130),
  ('desk', 'Desk', 'アプリ横断の統合画面', 'paused', '凍結', '各アプリが揃うまで非公開', 'not_public', '', 'コード上にルートがあっても、公開済みと扱わない。', '', 140),
  ('mikkeos', 'mikkeOS共通', 'ログイン・ホーム・共通UI・公開導線', 'active', '統制強化', 'ホームページ表記と公開URLの整合', 'public', '/home', '本番は公開中。各アプリの表記と配布URLは個別確認が必要。', 'master', 150)
on conflict (app_key) do nothing;

insert into public.mikkeos_implementation_gates (project_id, gate_key, status, summary)
select project.id, gate.gate_key, 'not_started', '証拠を確認して更新します。'
from public.mikkeos_implementation_projects project
cross join (values
  ('product'), ('ui'), ('feature'), ('shared'), ('auth'), ('database'), ('billing'), ('legal'),
  ('checks'), ('git'), ('deployment'), ('production'), ('homepage'), ('promotion'), ('operations')
) as gate(gate_key)
on conflict (project_id, gate_key) do nothing;

update public.mikkeos_implementation_gates gate
set status = seed.status, summary = seed.summary, updated_at = now()
from (
  select project.id as project_id, valueset.gate_key, valueset.status, valueset.summary
  from public.mikkeos_implementation_projects project
  join (values
    ('academy', 'ui', 'in_progress', 'クラス・講師依頼UIを専用ブランチで実装中。'),
    ('academy', 'feature', 'in_progress', 'クラス日程と講師依頼フローを継続実装中。'),
    ('academy', 'checks', 'verified', '2026-08-15の専用worktreeでlint成功。'),
    ('academy', 'git', 'in_progress', 'masterより4コミット先行。PRと統合は未実施。'),
    ('marketnote', 'feature', 'in_progress', 'イベント種類別の自動サマリーopt-inを実装済み。'),
    ('marketnote', 'git', 'in_progress', 'auto-summary-v2はmaster未反映。'),
    ('community', 'ui', 'in_progress', '未コミットのpolish候補を回収・確認中。'),
    ('community', 'billing', 'blocked', 'Stripeの課金ライフサイクルが未完了。'),
    ('community', 'legal', 'blocked', '有料公開の規約・プライバシー・データライフサイクルが未承認。'),
    ('community', 'operations', 'blocked', 'バックアップ、事故対応、本番メール運用が未完了。'),
    ('mikkeos', 'homepage', 'in_progress', '各アプリの配布URLと公開表記を再確認中。'),
    ('mikkeos', 'auth', 'verified', 'パスワード再設定フローはmaster反映済み。')
  ) as valueset(app_key, gate_key, status, summary) on valueset.app_key = project.app_key
) as seed
where gate.project_id = seed.project_id and gate.gate_key = seed.gate_key;

insert into public.mikkeos_implementation_items
  (project_id, item_type, status, priority, title, body, question, evidence_ref)
select id, 'approval', 'waiting_user', 'high', '一般販売・有料公開の承認', '法務、課金、返金、データ保持、運用手順の各ゲートが未完了です。', 'ゲート完了後に別途承認するため、現時点では一般販売を開始しません。', '2026-08-15 inventory'
from public.mikkeos_implementation_projects where app_key = 'community';
