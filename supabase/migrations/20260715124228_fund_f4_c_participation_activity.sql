-- Fund F4-c: make the private participation Activity Log atomic with claim acceptance.

create or replace function public.accept_fund_support_claim(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_claim public.fund_support_claims%rowtype;
  v_support public.fund_supports%rowtype;
  v_project public.fund_projects%rowtype;
  v_profile_id uuid;
  v_participation_id uuid;
begin
  if v_actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid claim token' using errcode = '22023';
  end if;

  select * into v_claim
  from public.fund_support_claims
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found
    or v_claim.revoked_at is not null
    or v_claim.accepted_at is not null
    or v_claim.expires_at <= now() then
    raise exception 'claim token is unavailable' using errcode = '42501';
  end if;

  select * into v_support
  from public.fund_supports
  where id = v_claim.support_id
  for update;

  select * into v_project
  from public.fund_projects
  where id = v_support.project_id;

  if v_support.record_status <> 'valid' then
    raise exception 'support record is unavailable' using errcode = '42501';
  end if;

  select id into v_profile_id
  from public.profiles
  where user_id = v_actor
  limit 1;

  if v_profile_id is null then
    raise exception 'a Mikke profile is required before accepting a claim' using errcode = '42501';
  end if;

  insert into public.fund_participations (
    project_id,
    support_id,
    owner_user_id,
    supporter_user_id,
    supporter_profile_id,
    owner_consent_status,
    supporter_consent_status,
    display_mode
  ) values (
    v_project.id,
    v_support.id,
    v_project.owner_user_id,
    v_actor,
    v_profile_id,
    'granted',
    'pending',
    'hidden'
  ) returning id into v_participation_id;

  insert into public.activity_logs (
    user_id,
    profile_id,
    activity_type,
    category,
    source_service,
    source_record_id,
    occurred_at,
    title,
    description,
    visibility,
    status,
    display_on_story,
    display_in_timeline,
    display_as_achievement,
    counts_toward_summary,
    has_financial_value,
    amount,
    transaction_type,
    payment_status
  ) values (
    v_actor,
    v_profile_id,
    'fund_participation_recorded',
    'production',
    'fund',
    v_participation_id::text,
    now(),
    'Fundの応援を受け取りました',
    '応援参加をMikke IDへ登録しました。応援者情報と金額は公開されません。',
    'private',
    'completed',
    false,
    false,
    false,
    false,
    false,
    null,
    'none',
    'not_required'
  )
  on conflict (profile_id, source_service, source_record_id) do nothing;

  update public.fund_support_claims
  set accepted_by_user_id = v_actor,
      accepted_at = now()
  where id = v_claim.id;

  return v_participation_id;
end;
$$;

insert into public.activity_logs (
  user_id,
  profile_id,
  activity_type,
  category,
  source_service,
  source_record_id,
  occurred_at,
  title,
  description,
  visibility,
  status,
  display_on_story,
  display_in_timeline,
  display_as_achievement,
  counts_toward_summary,
  has_financial_value,
  amount,
  transaction_type,
  payment_status
)
select
  supporter_user_id,
  supporter_profile_id,
  'fund_participation_recorded',
  'production',
  'fund',
  id::text,
  created_at,
  'Fundの応援を受け取りました',
  '応援参加をMikke IDへ登録しました。応援者情報と金額は公開されません。',
  'private',
  'completed',
  false,
  false,
  false,
  false,
  false,
  null,
  'none',
  'not_required'
from public.fund_participations
on conflict (profile_id, source_service, source_record_id) do nothing;

comment on function public.accept_fund_support_claim(text) is
  'Atomically accepts a Fund claim, creates the participation, and records a private non-financial Activity Log.';

select 'Fund F4-c participation Activity Log migration applied' as result;
