-- Cover every foreign key on Community thread reactions.

create index if not exists community_post_reactions_community_idx
  on public.community_post_reactions (community_id);
create index if not exists community_post_reactions_post_room_community_idx
  on public.community_post_reactions (post_id, room_id, community_id);

create index if not exists community_comment_reactions_community_idx
  on public.community_comment_reactions (community_id);
create index if not exists community_comment_reactions_post_room_community_idx
  on public.community_comment_reactions (post_id, room_id, community_id);
create index if not exists community_comment_reactions_comment_post_idx
  on public.community_comment_reactions (comment_id, post_id);
