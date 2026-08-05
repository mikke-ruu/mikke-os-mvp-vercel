create index if not exists community_communities_owner_user_idx
  on public.community_communities (owner_user_id)
  where owner_user_id is not null;
create index if not exists community_member_profiles_user_idx
  on public.community_member_profiles (user_id);
create index if not exists community_posts_author_user_idx
  on public.community_posts (author_user_id);
create index if not exists community_comments_author_user_idx
  on public.community_comments (author_user_id);
create index if not exists community_event_attendees_user_idx
  on public.community_event_attendees (user_id);
create index if not exists community_member_entitlements_user_idx
  on public.community_member_entitlements (user_id);
create index if not exists community_member_entitlements_granted_by_idx
  on public.community_member_entitlements (granted_by_user_id)
  where granted_by_user_id is not null;
create index if not exists community_room_entitlement_rules_room_community_idx
  on public.community_room_entitlement_rules (room_id, community_id);
