"use client";

import { MikkeMediaPicker } from "@/components/media/MikkeMediaPicker";
import type { PageAssetRef } from "@/lib/page/types";

export function PageImageUploader({ siteId, currentUrl, onUploaded, compact = false }: {
  siteId: string;
  currentUrl?: string;
  onUploaded: (asset: PageAssetRef) => void;
  compact?: boolean;
}) {
  void siteId;
  return <MikkeMediaPicker currentUrl={currentUrl} sourceApp="page" compact={compact} onSelect={(asset) => onUploaded({
    mediaAssetId: asset.id,
    storagePath: asset.storagePath,
    publicUrl: asset.publicUrl,
    fileName: asset.originalName,
    mimeType: asset.mimeType,
    size: asset.byteSize,
    width: asset.width,
    height: asset.height
  })} />;
}
