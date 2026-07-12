export type ChannelStatus = "not_listed" | "listed" | "sold";

export type StudioItem = {
  id: string;
  ownerProfileId: string;
  sku: string;
  title: string;
  category: string;
  color: string;
  material: string;
  condition: string;
  price: number | null;
  cost: number | null;
  stock: number;
  description: string;
  photoUrl: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StudioChannel = {
  id: string;
  itemId: string;
  channelName: string;
  status: ChannelStatus;
  url: string;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type StudioSale = {
  id: string;
  itemId: string;
  channelName: string;
  soldPrice: number;
  soldAt: string;
  memo: string;
  createdAt: string;
};

export const channelStatusLabels: Record<ChannelStatus, string> = {
  not_listed: "未出品",
  listed: "出品中",
  sold: "売却済み"
};
