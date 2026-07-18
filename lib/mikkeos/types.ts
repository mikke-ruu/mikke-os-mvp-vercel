export type AppKey =
  | "market_note"
  | "event"
  | "order"
  | "item_studio"
  | "academy"
  | "session"
  | "community"
  | "team_works"
  | "fund"
  | "page";

export type AmountType = "income" | "expense" | "none";
export type Visibility = "public" | "private";

export type PaymentStatus = "paid" | "unpaid" | "not_required";

export type UnifiedProfile = {
  id: string;
  displayName: string;
  handle: string;
  brandName: string;
  iconUrl?: string;
  area: string;
  bio: string;
  createdAt: string;
};

export type UnifiedActivityLog = {
  id: string;
  profileId: string;
  appKey: AppKey;
  eventType: string;
  title: string;
  description?: string;
  occurredAt: string;
  amount?: number;
  amountType: AmountType;
  sourceId: string;
  visibility: Visibility;
  storyEnabled: boolean;
  deskEnabled: boolean;
  countsTowardSummary?: boolean;
  metadata?: {
    paymentStatus?: PaymentStatus;
    location?: string;
    category?: string;
    storySection?: string;
    deskGroup?: string;
    sourceLabel?: string;
    publicPath?: string;
  };
  createdAt: string;
};

export type MikkeAppDefinition = {
  key: AppKey;
  name: string;
  shortName: string;
  role: string;
  status: "active" | "prototype" | "planned";
  activityExamples: string[];
  storyOutputs: string[];
  deskOutputs: string[];
  accent: "terracotta" | "green" | "navy" | "gold" | "rose" | "blue" | "slate" | "violet";
};

export type ActivityActionPreset = {
  id: string;
  appKey: AppKey;
  label: string;
  title: string;
  description: string;
  eventType: string;
  amount?: number;
  amountType: AmountType;
  visibility: Visibility;
  storyEnabled: boolean;
  deskEnabled: boolean;
  countsTowardSummary?: boolean;
  sourceLabel: string;
  storySection?: string;
  deskGroup?: string;
};
