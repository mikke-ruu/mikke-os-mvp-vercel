"use client";

import { supabase } from "@/lib/supabase/client";
import type { MikkeMediaAsset, MikkeMediaUsage } from "./types";

export const MIKKE_MEDIA_BUCKET = "mikke-media";
export const MIKKE_MEDIA_FREE_BYTES = 100 * 1024 * 1024;
export const MIKKE_MEDIA_SOURCE_MAX_BYTES = 15 * 1024 * 1024;
export const MIKKE_MEDIA_ASSET_MAX_BYTES = 3 * 1024 * 1024;

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type AssetRow = {
  id: string;
  owner_id: string;
  storage_path: string;
  original_name: string;
  mime_type: "image/webp";
  byte_size: number | string;
  width: number | null;
  height: number | null;
  source_app: string;
  created_at: string;
};

function publicUrl(storagePath: string) {
  return supabase.storage.from(MIKKE_MEDIA_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

function toAsset(row: AssetRow): MikkeMediaAsset {
  return {
    id: row.id,
    ownerId: row.owner_id,
    storagePath: row.storage_path,
    publicUrl: publicUrl(row.storage_path),
    originalName: row.original_name,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size),
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    sourceApp: row.source_app,
    createdAt: row.created_at
  };
}

function rpcRow(data: unknown): AssetRow {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") throw new Error("画像情報を確認できませんでした。");
  return value as AssetRow;
}

function mediaError(message: string) {
  if (message.includes("MIKKE_MEDIA_QUOTA_EXCEEDED")) return "無料枠100MBに達しました。不要な画像を整理してください。";
  if (message.includes("MIKKE_MEDIA_INVALID_FILE")) return "画像を小さくできませんでした。別の画像を選択してください。";
  if (message.includes("MIKKE_MEDIA_AUTH_REQUIRED")) return "画像を保存するにはログインしてください。";
  if (message.includes("MIKKE_MEDIA_ASSET_IN_USE")) return "この画像はページや投稿で使用中です。使用箇所から外して保存してから削除してください。";
  if (message.includes("MIKKE_MEDIA_ASSET_NOT_AVAILABLE")) return "画像が見つからないか、現在は操作できません。";
  return message;
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("画像を変換できませんでした。")), "image/webp", quality);
  });
}

async function optimizeImage(file: File) {
  if (!allowedTypes.has(file.type)) throw new Error("JPG、PNG、WebP画像を選択してください。");
  if (file.size > MIKKE_MEDIA_SOURCE_MAX_BYTES) throw new Error("元画像は15MB以下にしてください。");

  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  let blob: Blob | undefined;
  let width = 0;
  let height = 0;

  for (const quality of [0.82, 0.72, 0.64]) {
    width = Math.max(1, Math.round(bitmap.width * scale));
    height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      throw new Error("画像を変換できませんでした。");
    }
    context.drawImage(bitmap, 0, 0, width, height);
    blob = await canvasBlob(canvas, quality);
    if (blob.size <= MIKKE_MEDIA_ASSET_MAX_BYTES) break;
    scale *= 0.8;
  }

  bitmap.close();
  if (!blob || blob.size > MIKKE_MEDIA_ASSET_MAX_BYTES) throw new Error("画像を3MB以下に圧縮できませんでした。");
  return { blob, width, height };
}

export async function getMikkeMediaUsage(): Promise<MikkeMediaUsage> {
  const { data, error } = await supabase.rpc("get_mikke_media_usage");
  if (error) throw new Error(mediaError(error.message));
  const row = (Array.isArray(data) ? data[0] : data) as { used_bytes?: number | string; max_bytes?: number | string; asset_count?: number | string } | null;
  return {
    usedBytes: Number(row?.used_bytes ?? 0),
    maxBytes: Number(row?.max_bytes ?? MIKKE_MEDIA_FREE_BYTES),
    assetCount: Number(row?.asset_count ?? 0)
  };
}

export async function listMikkeMediaAssets(limit = 100): Promise<MikkeMediaAsset[]> {
  const { data, error } = await supabase
    .from("mikke_media_assets")
    .select("id,owner_id,storage_path,original_name,mime_type,byte_size,width,height,source_app,created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(mediaError(error.message));
  return (data as AssetRow[]).map(toAsset);
}

export async function uploadMikkeMediaImage(input: { userId: string; file: File; sourceApp: string }): Promise<MikkeMediaAsset> {
  const optimized = await optimizeImage(input.file);
  const now = new Date();
  const storagePath = [
    input.userId,
    "images",
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
    `${crypto.randomUUID()}.webp`
  ].join("/");

  const { data: reservedData, error: reserveError } = await supabase.rpc("reserve_mikke_media_asset", {
    p_storage_path: storagePath,
    p_original_name: input.file.name,
    p_mime_type: "image/webp",
    p_byte_size: optimized.blob.size,
    p_width: optimized.width,
    p_height: optimized.height,
    p_source_app: input.sourceApp
  });
  if (reserveError) throw new Error(mediaError(reserveError.message));
  const reserved = rpcRow(reservedData);

  const uploadFile = new File([optimized.blob], "image.webp", { type: "image/webp" });
  const { error: uploadError } = await supabase.storage.from(MIKKE_MEDIA_BUCKET).upload(storagePath, uploadFile, {
    cacheControl: "31536000",
    contentType: "image/webp",
    upsert: false
  });
  if (uploadError) {
    await supabase.rpc("cancel_mikke_media_reservation", { p_asset_id: reserved.id });
    throw new Error(mediaError(uploadError.message));
  }

  const { data: finalizedData, error: finalizeError } = await supabase.rpc("finalize_mikke_media_asset", { p_asset_id: reserved.id });
  if (finalizeError) {
    await supabase.storage.from(MIKKE_MEDIA_BUCKET).remove([storagePath]);
    await supabase.rpc("cancel_mikke_media_reservation", { p_asset_id: reserved.id });
    throw new Error(mediaError(finalizeError.message));
  }
  return toAsset(rpcRow(finalizedData));
}

export async function syncMikkeMediaUsages(input: { appKey: string; entityType: string; entityId: string; assetIds: string[] }) {
  const { error } = await supabase.rpc("sync_mikke_media_usages", {
    p_app_key: input.appKey,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_asset_ids: [...new Set(input.assetIds)]
  });
  if (error) throw new Error(mediaError(error.message));
}

export async function deleteMikkeMediaAsset(asset: MikkeMediaAsset) {
  const { error: trashError } = await supabase.rpc("trash_mikke_media_asset", { p_asset_id: asset.id });
  if (trashError) throw new Error(mediaError(trashError.message));

  const { error: removeError } = await supabase.storage.from(MIKKE_MEDIA_BUCKET).remove([asset.storagePath]);
  if (removeError) {
    await supabase.rpc("restore_mikke_media_asset", { p_asset_id: asset.id });
    throw new Error(mediaError(removeError.message));
  }

  const { error: purgeError } = await supabase.rpc("purge_mikke_media_asset_record", { p_asset_id: asset.id });
  if (purgeError) throw new Error(mediaError(purgeError.message));
}

export function formatMediaBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}
