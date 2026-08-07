-- Cover the phase 1 soft-delete audit foreign keys reported by the DB advisor.
create index if not exists community_posts_deleted_by_user_idx
  on public.community_posts (deleted_by_user_id)
  where deleted_by_user_id is not null;

create index if not exists community_comments_deleted_by_user_idx
  on public.community_comments (deleted_by_user_id)
  where deleted_by_user_id is not null;
