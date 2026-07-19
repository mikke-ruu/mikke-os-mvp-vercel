"use client";

import { supabase } from "@/lib/supabase/client";
import type { PageAssetRef } from "./types";

export const PAGE_ASSET_BUCKET = "page-assets";
export const PAGE_ASSET_MAX_BYTES = 10 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 100) || "asset";
}

async function optimizeImage(file: File) {
  if (!allowedTypes.has(file.type)) throw new Error("JPG、PNG、WebP画像を選択してください。");
  if (file.size > PAGE_ASSET_MAX_BYTES) throw new Error("画像は10MB以下にしてください。");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("画像を変換できませんでした。");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("画像を変換できませんでした。")), "image/webp", 0.86));
  return { blob, width, height };
}

export async function uploadPageAsset(input: { userId: string; siteId: string; file: File }): Promise<PageAssetRef> {
  const optimized = await optimizeImage(input.file);
  const now = new Date();
  const path = [
    safeSegment(input.userId),
    safeSegment(input.siteId),
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
    `${crypto.randomUUID()}.webp`
  ].join("/");
  const uploadFile = new File([optimized.blob], `${safeSegment(input.file.name.replace(/\.[^.]+$/, ""))}.webp`, { type: "image/webp" });
  const { data, error } = await supabase.storage.from(PAGE_ASSET_BUCKET).upload(path, uploadFile, {
    cacheControl: "31536000",
    contentType: "image/webp",
    upsert: false
  });
  if (error) throw new Error(error.message.includes("Bucket not found") ? "画像保存領域の準備がまだ完了していません。" : error.message);
  const { data: publicData } = supabase.storage.from(PAGE_ASSET_BUCKET).getPublicUrl(data.path);
  return {
    storagePath: data.path,
    publicUrl: publicData.publicUrl,
    fileName: input.file.name,
    mimeType: "image/webp",
    size: optimized.blob.size,
    width: optimized.width,
    height: optimized.height
  };
}
