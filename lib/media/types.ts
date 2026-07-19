export type MikkeMediaAsset = {
  id: string;
  ownerId: string;
  storagePath: string;
  publicUrl: string;
  originalName: string;
  mimeType: "image/webp";
  byteSize: number;
  width?: number;
  height?: number;
  sourceApp: string;
  createdAt: string;
};

export type MikkeMediaUsage = {
  usedBytes: number;
  maxBytes: number;
  assetCount: number;
};
