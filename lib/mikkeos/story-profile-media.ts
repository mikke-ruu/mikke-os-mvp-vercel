import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoryPortfolioItem, StoryProfileView } from "./story-profile-store";

type DbClient = SupabaseClient<any, "public", any>;
type StoryImageKind = "avatar" | "banner" | "portfolio";

export type StoryImageCrop = {
  x: number;
  y: number;
};

type StoryImageTransform = {
  width?: number;
  height?: number;
  resize?: "cover" | "contain" | "fill";
  quality?: number;
};

const storyBucket = "story-public";
const maxInputBytes = 40 * 1024 * 1024;

async function decodeImage(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap as CanvasImageSource,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close()
    };
  } catch {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("この写真形式を読み込めませんでした。JPEG・PNG・WebPの写真を選んでください。"));
        element.src = objectUrl;
      });
      return {
        source: image as CanvasImageSource,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: () => URL.revokeObjectURL(objectUrl)
      };
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: "image/webp" | "image/jpeg", quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("写真を変換できませんでした。別の写真を選んでください。")),
      type,
      quality
    );
  });
}

async function encodeWithinLimit(canvas: HTMLCanvasElement, targetBytes: number) {
  for (const quality of [0.86, 0.78, 0.7, 0.62, 0.54]) {
    const webp = await canvasBlob(canvas, "image/webp", quality);
    if (webp.size <= targetBytes) return webp;
  }

  const fallback = await canvasBlob(canvas, "image/jpeg", 0.72);
  if (fallback.size <= targetBytes) return fallback;
  throw new Error("写真を十分に小さくできませんでした。別の写真を選んでください。");
}

async function imageToUploadBlob(file: File, kind: StoryImageKind, crop?: StoryImageCrop) {
  if (file.size > maxInputBytes) throw new Error("写真が大きすぎます。40MB以下の写真を選んでください。");
  const looksLikeImage = file.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name);
  if (!looksLikeImage) throw new Error("写真ファイルを選んでください。");

  const decoded = await decodeImage(file);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("写真を変換できませんでした。別の写真を選んでください。");

    if ((kind === "avatar" || kind === "banner") && crop) {
      const targetAspect = kind === "avatar" ? 1 : 3;
      let sourceWidth = decoded.width;
      let sourceHeight = decoded.height;
      let sourceX = 0;
      let sourceY = 0;
      if (decoded.width / decoded.height > targetAspect) {
        sourceWidth = decoded.height * targetAspect;
        sourceX = (decoded.width - sourceWidth) * Math.min(1, Math.max(0, crop.x / 100));
      } else {
        sourceHeight = decoded.width / targetAspect;
        sourceY = (decoded.height - sourceHeight) * Math.min(1, Math.max(0, crop.y / 100));
      }
      canvas.width = kind === "avatar" ? 640 : 1500;
      canvas.height = kind === "avatar" ? 640 : 500;
      context.drawImage(decoded.source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    } else {
      const maxSide = kind === "avatar" ? 640 : kind === "banner" ? 1500 : 1600;
      const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height));
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    }

    const targetBytes = kind === "avatar" ? 450 * 1024 : kind === "banner" ? 850 * 1024 : 1100 * 1024;
    return encodeWithinLimit(canvas, targetBytes);
  } finally {
    decoded.close();
  }
}

export async function uploadStoryImage(
  client: DbClient,
  userId: string,
  file: File,
  kind: StoryImageKind,
  crop?: StoryImageCrop
) {
  const body = await imageToUploadBlob(file, kind, crop);
  const extension = body.type === "image/jpeg" ? "jpg" : "webp";
  const storagePath = `${userId}/${kind}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from(storyBucket).upload(storagePath, body, {
    contentType: body.type,
    cacheControl: "31536000",
    upsert: false
  });
  if (error) throw error;
  const { data, error: signError } = await client.storage.from(storyBucket).createSignedUrl(storagePath, 60 * 60);
  if (signError) throw signError;
  return { storagePath, imageUrl: data.signedUrl };
}

export async function removeStoryImages(client: DbClient, paths: string[]) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (!uniquePaths.length) return;
  const { error } = await client.storage.from(storyBucket).remove(uniquePaths);
  if (error) throw error;
}

export async function getStorySignedUrl(client: DbClient, path: string, transform?: StoryImageTransform) {
  if (!path) return "";
  const options = transform ? { transform } : undefined;
  const { data, error } = await client.storage.from(storyBucket).createSignedUrl(path, 60 * 60, options);
  return error ? "" : data.signedUrl;
}

export async function hydrateStoryProfileMedia(client: DbClient, story: StoryProfileView) {
  const [avatarUrl, bannerUrl, portfolioUrls] = await Promise.all([
    story.avatarStoragePath
      ? getStorySignedUrl(client, story.avatarStoragePath, { width: 320, height: 320, resize: "cover", quality: 82 })
      : Promise.resolve(story.avatarUrl),
    getStorySignedUrl(client, story.bannerStoragePath, { width: 1000, height: 334, resize: "cover", quality: 82 }),
    Promise.all(story.portfolio.map((item) => getStorySignedUrl(client, item.storagePath, { width: 900, quality: 80 })))
  ]);
  return {
    ...story,
    avatarUrl: avatarUrl || story.avatarUrl,
    bannerUrl,
    portfolio: story.portfolio.map((item: StoryPortfolioItem, index) => ({ ...item, imageUrl: portfolioUrls[index] ?? "" }))
  };
}
