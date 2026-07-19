"use client";

import { uploadMikkeMediaImage } from "@/lib/media/client";
import type { PageAssetRef } from "./types";

export async function uploadPageAsset(input: { userId: string; siteId: string; file: File }): Promise<PageAssetRef> {
  const asset = await uploadMikkeMediaImage({ userId: input.userId, file: input.file, sourceApp: "page" });
  return {
    mediaAssetId: asset.id,
    storagePath: asset.storagePath,
    publicUrl: asset.publicUrl,
    fileName: asset.originalName,
    mimeType: asset.mimeType,
    size: asset.byteSize,
    width: asset.width,
    height: asset.height
  };
}
