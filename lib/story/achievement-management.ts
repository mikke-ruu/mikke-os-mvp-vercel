import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<any, "public", any>;

export type StoryAchievementDisplayMode = "count_only" | "card_only" | "card_and_count";
export type StoryAchievementPublicationStatus = "draft" | "published" | "withdrawn";

export type StoryAchievementSummary = {
  achievementId: string;
  displayMode: StoryAchievementDisplayMode;
  publicationStatus: StoryAchievementPublicationStatus;
  publicTitle: string;
  publicTypeLabel: string;
  occurredOn: string;
  publicLocation: string;
  publishedAt: string;
  updatedAt: string;
};

type StoryAchievementRpcRow = {
  achievement_id: string;
  display_mode: StoryAchievementDisplayMode;
  publication_status: StoryAchievementPublicationStatus;
  public_title: string | null;
  public_type_label: string | null;
  occurred_on: string | null;
  public_location: string | null;
  published_at: string | null;
  updated_at: string;
};

export class StoryAchievementRpcUnavailableError extends Error {
  constructor() {
    super("STORY achievement RPC is not available yet.");
    this.name = "StoryAchievementRpcUnavailableError";
  }
}

export async function listMyStoryAchievements(client: DbClient) {
  const { data, error } = await client.rpc("story_achievement_list_mine");
  if (error) throwStoryAchievementError(error);
  return ((data ?? []) as StoryAchievementRpcRow[]).map(mapStoryAchievementRow);
}

export async function publishMyStoryAchievement(client: DbClient, achievementId: string) {
  const { data, error } = await client.rpc("story_achievement_publish_mine", {
    p_achievement_id: achievementId
  });
  if (error) throwStoryAchievementError(error);
  return mapSingleRow(data);
}

export async function withdrawMyStoryAchievement(client: DbClient, achievementId: string) {
  const { data, error } = await client.rpc("story_achievement_withdraw_mine", {
    p_achievement_id: achievementId
  });
  if (error) throwStoryAchievementError(error);
  return mapSingleRow(data);
}

function mapSingleRow(value: unknown) {
  const row = (Array.isArray(value) ? value[0] : value) as StoryAchievementRpcRow | null;
  if (!row) throw new Error("STORYの実績を更新できませんでした。");
  return mapStoryAchievementRow(row);
}

function mapStoryAchievementRow(row: StoryAchievementRpcRow): StoryAchievementSummary {
  return {
    achievementId: row.achievement_id,
    displayMode: row.display_mode,
    publicationStatus: row.publication_status,
    publicTitle: row.public_title ?? "",
    publicTypeLabel: row.public_type_label ?? "",
    occurredOn: row.occurred_on ?? "",
    publicLocation: row.public_location ?? "",
    publishedAt: row.published_at ?? "",
    updatedAt: row.updated_at
  };
}

function throwStoryAchievementError(error: { code?: string; message?: string }): never {
  const message = error.message?.toLowerCase() ?? "";
  if (
    error.code === "42883" ||
    error.code === "PGRST202" ||
    message.includes("could not find the function") ||
    (message.includes("function") && message.includes("does not exist")) ||
    message.includes("schema cache")
  ) {
    throw new StoryAchievementRpcUnavailableError();
  }
  throw error;
}
