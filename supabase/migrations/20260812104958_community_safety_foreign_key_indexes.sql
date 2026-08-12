create index if not exists community_blocked_words_created_by_idx
  on public.community_blocked_words (created_by_user_id);

create index if not exists community_consent_records_community_idx
  on public.community_consent_records (community_id);

create index if not exists community_inquiries_handled_by_idx
  on public.community_inquiries (handled_by_user_id);

create index if not exists community_join_applications_reviewed_by_idx
  on public.community_join_applications (reviewed_by_user_id);

create index if not exists community_moderation_actions_actor_idx
  on public.community_moderation_actions (actor_user_id);

create index if not exists community_reports_handled_by_idx
  on public.community_reports (handled_by_user_id);
