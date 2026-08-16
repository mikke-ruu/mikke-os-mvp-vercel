import { isMarketNoteGuestProfile } from "@/lib/marketnote-guest";
import { getMyStoryProfile } from "@/lib/mikkeos/story-profile-db";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

export type StoryAchievementDisplayMode = "count_only" | "card_only" | "card_and_count";
export type StoryAchievementPublicationStatus = "draft" | "published" | "withdrawn";

export type MarketNoteStoryAchievement = {
  achievement_id: string;
  display_mode: StoryAchievementDisplayMode;
  publication_status: StoryAchievementPublicationStatus;
  public_title: string | null;
  public_type_label: string | null;
  occurred_on: string | null;
  public_location: string | null;
};

export async function hasMyStory(profile: Profile) {
  if (isMarketNoteGuestProfile(profile)) return false;
  return Boolean(await getMyStoryProfile(supabase));
}

export async function getMarketNoteStoryAchievement(profile: Profile, eventId: string) {
  if (isMarketNoteGuestProfile(profile)) return null;
  const { data, error } = await supabase.rpc("story_achievement_get_mine_from_marketnote", {
    p_source_record_id: eventId
  });
  if (error) throw storyAchievementError(error);
  return firstRow(data) as MarketNoteStoryAchievement | null;
}

export async function stageMarketNoteStoryAchievement(profile: Profile, eventId: string, input: {
  displayMode: StoryAchievementDisplayMode;
  publicTitle: string;
  publicTypeLabel: string;
  occurredOn: string;
  publicLocation: string | null;
}) {
  if (isMarketNoteGuestProfile(profile)) throw new Error("+STORYを使うにはログインしてください。");
  const cardEnabled = input.displayMode !== "count_only";
  const { data, error } = await supabase.rpc("story_achievement_stage_from_marketnote", {
    p_source_record_id: eventId,
    p_display_mode: input.displayMode,
    p_public_title: cardEnabled ? input.publicTitle.trim() : null,
    p_public_type_label: cardEnabled ? input.publicTypeLabel.trim() : null,
    p_occurred_on: cardEnabled ? input.occurredOn : null,
    p_public_location: cardEnabled ? input.publicLocation?.trim() || null : null
  });
  if (error) throw storyAchievementError(error);
  return firstRow(data) as MarketNoteStoryAchievement;
}

export async function withdrawMarketNoteStoryAchievement(profile: Profile, eventId: string) {
  if (isMarketNoteGuestProfile(profile)) throw new Error("+STORYを使うにはログインしてください。");
  const { data, error } = await supabase.rpc("story_achievement_withdraw_from_marketnote", {
    p_source_record_id: eventId
  });
  if (error) throw storyAchievementError(error);
  return firstRow(data) as Pick<MarketNoteStoryAchievement, "achievement_id" | "display_mode" | "publication_status">;
}

function firstRow(value: unknown) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function storyAchievementError(error: { code?: string; message?: string }) {
  if (error.code === "PGRST202" || error.code === "42883") {
    return new Error("STORY連携は準備中です。実績画面の確認後に利用できます。");
  }
  if (error.code === "P0002") return new Error(error.message || "対象の予定またはSTORYが見つかりません。");
  if (error.code === "42501") return new Error("この予定をSTORYへ追加する権限がありません。");
  return new Error(error.message || "STORYへ接続できませんでした。");
}
