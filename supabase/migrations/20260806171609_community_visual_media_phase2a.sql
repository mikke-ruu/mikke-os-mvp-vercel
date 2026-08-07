-- Community phase 2A: public visual branding and post images.
-- Binary image data continues to use the existing mikke-media bucket and quota/RLS flow.

alter table public.community_communities
  add column if not exists logo_url text,
  add column if not exists banner_url text;

alter table public.community_posts
  add column if not exists image_url text;

alter table public.community_communities
  drop constraint if exists community_communities_logo_url_check,
  drop constraint if exists community_communities_banner_url_check;

alter table public.community_communities
  add constraint community_communities_logo_url_check
    check (logo_url is null or (char_length(logo_url) <= 2048 and logo_url ~ '^https://')),
  add constraint community_communities_banner_url_check
    check (banner_url is null or (char_length(banner_url) <= 2048 and banner_url ~ '^https://'));

alter table public.community_posts
  drop constraint if exists community_posts_image_url_check;

alter table public.community_posts
  add constraint community_posts_image_url_check
    check (image_url is null or (char_length(image_url) <= 2048 and image_url ~ '^https://'));

comment on column public.community_communities.logo_url is
  'Public Community logo image URL backed by the shared mikke-media asset flow.';
comment on column public.community_communities.banner_url is
  'Public Community wide banner image URL backed by the shared mikke-media asset flow.';
comment on column public.community_posts.image_url is
  'Optional public post image URL backed by the shared mikke-media asset flow.';
