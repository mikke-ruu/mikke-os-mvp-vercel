import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";
import type { StoryProfileLink, StoryProfileView } from "./story-profile-store";

type DbClient = SupabaseClient<any, "public", any>;

type StoryProfileRow = {
  handle: string;
  display_name: string;
  role_label: string;
  bio: string;
  area: string;
  avatar_url: string | null;
  avatar_storage_path: string | null;
  website_url: string | null;
  shop_url: string | null;
  sns_links: StoryProfileLink[];
  tags: string[];
  status_label: string;
  pickup_text: string;
  publication_status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

const storyProfileDbTimeoutMs = 7000;
const storyProfileColumns = [
  "handle", "display_name", "role_label", "bio", "area", "avatar_url", "avatar_storage_path",
  "website_url", "shop_url", "sns_links", "tags", "status_label", "pickup_text", "publication_status",
  "published_at", "created_at", "updated_at"
].join(",");

function withStoryProfileTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_resolve, reject) => window.setTimeout(() => reject(new Error(`${label} timed out.`)), storyProfileDbTimeoutMs))
  ]);
}

function mapStoryProfileRow(row: StoryProfileRow): StoryProfileView {
  return {
    displayName: row.display_name,
    handle: row.handle,
    role: row.role_label,
    area: row.area,
    bio: row.bio,
    avatarUrl: row.avatar_url ?? "",
    tags: row.tags ?? [],
    status: row.status_label,
    websiteUrl: row.website_url ?? "",
    shopUrl: row.shop_url ?? "",
    sns: row.sns_links ?? [],
    pickupText: row.pickup_text,
    isPublished: row.publication_status === "published"
  };
}

function storyProfilePayload(profile: Profile, story: StoryProfileView) {
  return {
    owner_user_id: profile.user_id,
    owner_profile_id: profile.id,
    handle: story.handle,
    display_name: story.displayName.trim(),
    role_label: story.role.trim(),
    bio: story.bio.trim(),
    area: story.area.trim(),
    avatar_url: story.avatarUrl.trim() || null,
    website_url: story.websiteUrl.trim() || null,
    shop_url: story.shopUrl.trim() || null,
    sns_links: story.sns.filter((item) => item.label.trim() && item.url.trim()),
    tags: story.tags,
    status_label: story.status.trim(),
    pickup_text: story.pickupText.trim(),
    publication_status: story.isPublished ? "published" : "draft",
    published_at: story.isPublished ? new Date().toISOString() : null
  };
}

export async function getMyStoryProfile(client: DbClient) {
  const { data, error } = await withStoryProfileTimeout(client.rpc("story_profile_get_mine"), "Loading STORY profile");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapStoryProfileRow(row as StoryProfileRow) : null;
}

export async function getPublishedStoryProfile(client: DbClient, handle: string) {
  const { data, error } = await withStoryProfileTimeout(
    client.from("story_profiles").select(storyProfileColumns).eq("handle", handle).eq("publication_status", "published").maybeSingle(),
    "Loading public STORY profile"
  );
  if (error) throw error;
  return data ? mapStoryProfileRow(data as unknown as StoryProfileRow) : null;
}

export async function saveMyStoryProfile(client: DbClient, profile: Profile, story: StoryProfileView) {
  const { data, error } = await withStoryProfileTimeout(
    client.from("story_profiles").upsert(storyProfilePayload(profile, story), { onConflict: "owner_profile_id" }).select(storyProfileColumns).single(),
    "Saving STORY profile"
  );
  if (error) throw error;
  return mapStoryProfileRow(data as unknown as StoryProfileRow);
}

export function getStorySaveErrorMessage(error: unknown) {
  const value = error as { code?: string; message?: string };
  if (value?.code === "23505" || value?.message?.includes("story_profiles_handle_lower_key")) {
    return "このURL名はすでに使われています。別のURL名を選んでください。";
  }
  if (value?.message?.includes("story_profiles_reserved_handle")) {
    return "このURL名は公式またはシステム用に予約されています。別のURL名を選んでください。";
  }
  return "STORYをサーバーへ保存できませんでした。通信状態を確認して、もう一度お試しください。";
}
