import type { SupabaseClient } from "@supabase/supabase-js";
import { getStorySignedUrl } from "./story-profile-media";

type DbClient = SupabaseClient<any, "public", any>;

export type StoryCollectionState = {
  viewerHasStory: boolean;
  isOwnStory: boolean;
  isSaved: boolean;
};

export type StoryCollectionItem = {
  collectionId: string;
  savedAt: string;
  available: boolean;
  handle: string;
  displayName: string;
  role: string;
  avatarUrl: string;
  themeKey: "blue" | "orange" | "green" | "yellow" | "pink";
};

export async function getStoryCollectionState(client: DbClient, handle: string): Promise<StoryCollectionState> {
  const { data, error } = await client.rpc("story_collection_get_state", { p_handle: handle });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    viewerHasStory: Boolean(row?.viewer_has_story),
    isOwnStory: Boolean(row?.is_own_story),
    isSaved: Boolean(row?.is_saved)
  };
}

export async function saveStoryToCollection(client: DbClient, handle: string) {
  const { error } = await client.rpc("story_collection_save", { p_handle: handle });
  if (error) throw error;
}

export async function removeStoryFromCollection(client: DbClient, collectionId: string) {
  const { error } = await client.rpc("story_collection_remove", { p_collection_id: collectionId });
  if (error) throw error;
}

export async function removeStoryFromCollectionByHandle(client: DbClient, handle: string) {
  const { error } = await client.rpc("story_collection_remove_by_handle", { p_handle: handle });
  if (error) throw error;
}

export async function listMyStoryCollection(client: DbClient): Promise<StoryCollectionItem[]> {
  const { data, error } = await client.rpc("story_collection_list_mine");
  if (error) throw error;
  return Promise.all((Array.isArray(data) ? data : []).map(async (row: any): Promise<StoryCollectionItem> => ({
    collectionId: row.collection_id,
    savedAt: row.saved_at,
    available: Boolean(row.available),
    handle: row.handle ?? "",
    displayName: row.display_name ?? "",
    role: row.role_label ?? "",
    avatarUrl: row.available && row.avatar_storage_path ? await getStorySignedUrl(client, row.avatar_storage_path, { width: 160, height: 160, resize: "cover", quality: 80 }) : "",
    themeKey: row.theme_key ?? "blue"
  })));
}
