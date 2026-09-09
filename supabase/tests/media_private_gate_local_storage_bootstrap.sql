-- Disposable PostgreSQL harness only. The schema-only public baseline omits
-- Supabase-managed Storage tables. This is NOT a migration or a live API model.
create table storage.buckets (
  id text primary key, name text not null, public boolean not null default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text,
  owner uuid, owner_id text, metadata jsonb, user_metadata jsonb, version text,
  created_at timestamptz default now(), updated_at timestamptz default now(), last_accessed_at timestamptz default now(),
  unique(bucket_id,name)
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(regexp_replace(name,'/[^/]*$',''),'/')
$$;
grant usage on schema storage to anon,authenticated,service_role;
grant all on storage.objects,storage.buckets to service_role;
