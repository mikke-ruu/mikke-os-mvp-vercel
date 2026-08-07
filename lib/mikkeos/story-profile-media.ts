import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoryPortfolioItem, StoryProfileView } from "./story-profile-store";

type DbClient = SupabaseClient<any, "public", any>;
const storyBucket = "story-public";

async function imageToWebp(file: File, maxSide: number) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("画像を変換できませんでした。");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("画像を変換できませんでした。")), "image/webp", 0.84));
}

export async function uploadStoryImage(client: DbClient, userId: string, file: File, kind: "avatar" | "banner" | "portfolio") {
  if (!file.type.startsWith("image/")) throw new Error("画像ファイルを選んでください。");
  const maxSide = kind === "avatar" ? 900 : 1800;
  const body = await imageToWebp(file, maxSide);
  if (body.size > 3 * 1024 * 1024) throw new Error("画像が大きすぎます。別の画像を選んでください。");
  const storagePath = `${userId}/${kind}/${crypto.randomUUID()}.webp`;
  const { error } = await client.storage.from(storyBucket).upload(storagePath, body, { contentType: "image/webp", upsert: false });
  if (error) throw error;
  const { data, error: signError } = await client.storage.from(storyBucket).createSignedUrl(storagePath, 60 * 60);
  if (signError) throw signError;
  return { storagePath, imageUrl: data.signedUrl };
}

export async function getStorySignedUrl(client: DbClient, path: string) {
  if (!path) return "";
  const { data, error } = await client.storage.from(storyBucket).createSignedUrl(path, 60 * 60);
  return error ? "" : data.signedUrl;
}

export async function hydrateStoryProfileMedia(client: DbClient, story: StoryProfileView) {
  const [avatarUrl, bannerUrl, portfolioUrls] = await Promise.all([
    story.avatarStoragePath ? getStorySignedUrl(client, story.avatarStoragePath) : Promise.resolve(story.avatarUrl),
    getStorySignedUrl(client, story.bannerStoragePath),
    Promise.all(story.portfolio.map((item) => getStorySignedUrl(client, item.storagePath)))
  ]);
  return {
    ...story,
    avatarUrl: avatarUrl || story.avatarUrl,
    bannerUrl,
    portfolio: story.portfolio.map((item: StoryPortfolioItem, index) => ({ ...item, imageUrl: portfolioUrls[index] ?? "" }))
  };
}
