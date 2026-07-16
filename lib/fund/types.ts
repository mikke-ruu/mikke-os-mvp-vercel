export type FundProjectType = "product" | "course" | "event" | "session" | "community" | "place" | "activity" | "other";
export type FundCampaignType = "preorder" | "early_application" | "reservation" | "sponsorship" | "support" | "interest";
export type FundStage = "concept" | "campaign" | "realization";
export type FundProjectStatus =
  | "draft"
  | "interest_open"
  | "ready"
  | "open"
  | "goal_reached"
  | "closed"
  | "in_progress"
  | "delivering"
  | "completed"
  | "postponed"
  | "cancelled"
  | "archived";
export type FundVisibility = "private" | "unlisted" | "public";
export type FundGoalType = "amount" | "supporters" | "reservations" | "participants" | "vendors" | "sponsors";
export type FundPlanType = FundCampaignType | "non_financial";
export type FundPlanStatus = "draft" | "active" | "sold_out" | "closed" | "hidden";
export type FundPaymentStatus = "unknown" | "pending" | "confirmed" | "refunded" | "cancelled";
export type FundFulfillmentStatus =
  | "not_required"
  | "waiting"
  | "preparing"
  | "scheduled"
  | "shipped"
  | "participated"
  | "in_service"
  | "completed"
  | "on_hold"
  | "cancelled";
export type FundSupportRecordStatus = "valid" | "test" | "duplicate" | "invalid";
export type FundUpdateVisibility = "draft" | "public";
export type FundChallengeRecordVisibility = "private" | "public";
export type FundTargetService = "order" | "item_studio" | "event" | "session" | "academy" | "community" | "team_works";
export type FundAppLinkStatus = "suggested" | "ready" | "linked" | "cancelled";

export type FundProject = {
  id: string;
  ownerProfileId: string;
  profileSlug: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  projectType: FundProjectType;
  campaignType: FundCampaignType;
  stage: FundStage;
  status: FundProjectStatus;
  visibility: FundVisibility;
  coverImageUrl: string;
  goalType: FundGoalType;
  goalValue: number;
  currentValue: number;
  displayAmount: boolean;
  startAt: string;
  endAt: string;
  externalPaymentUrl: string;
  externalApplicationUrl: string;
  whyNow: string;
  audience: string;
  useOfSupport: string;
  schedule: string;
  riskNotes: string;
  cancellationPolicy: string;
  contactNote: string;
  publishedAt: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FundPlan = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  imageUrl: string;
  planType: FundPlanType;
  price: number | null;
  quantityLimit: number | null;
  perPersonLimit: number | null;
  deliveryDate: string;
  externalPaymentUrl: string;
  externalApplicationUrl: string;
  requiredInformationNote: string;
  requiresShipping: boolean;
  status: FundPlanStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type FundPlanInput = Omit<FundPlan, "id" | "projectId" | "createdAt" | "updatedAt"> & { id?: string };
export type FundProjectInput = Omit<FundProject, "id" | "ownerProfileId" | "currentValue" | "publishedAt" | "completedAt" | "archivedAt" | "createdAt" | "updatedAt">;

export type FundSupport = {
  id: string;
  projectId: string;
  planId: string;
  supporterUserId: string;
  supporterName: string;
  supporterEmail: string;
  publicName: string;
  isAnonymous: boolean;
  supportType: FundPlanType;
  amount: number | null;
  quantity: number;
  paymentStatus: FundPaymentStatus;
  fulfillmentStatus: FundFulfillmentStatus;
  recordStatus: FundSupportRecordStatus;
  comment: string;
  source: string;
  supportedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FundSupportInput = Omit<FundSupport, "id" | "supporterUserId" | "completedAt" | "cancelledAt" | "createdAt" | "updatedAt">;

export type FundUpdate = {
  id: string;
  projectId: string;
  title: string;
  body: string;
  imageUrl: string;
  visibility: FundUpdateVisibility;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FundUpdateInput = Omit<FundUpdate, "id" | "publishedAt" | "createdAt" | "updatedAt">;

export type FundSupportSummary = {
  supporterCount: number;
  supportCount: number;
  quantity: number;
  confirmedAmount: number;
  completedCount: number;
};

export type FundChallengeRecord = {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  outcome: string;
  imageUrl: string;
  visibility: FundChallengeRecordVisibility;
  storyEnabled: boolean;
  completedAt: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FundChallengeRecordInput = Omit<FundChallengeRecord, "id" | "publishedAt" | "createdAt" | "updatedAt">;

export type FundAppLink = {
  id: string;
  projectId: string;
  targetService: FundTargetService;
  linkStatus: FundAppLinkStatus;
  createdAt: string;
  updatedAt: string;
};

export const fundProjectTypeLabels: Record<FundProjectType, string> = {
  product: "新しい商品・作品",
  course: "講座・教材",
  event: "イベント",
  session: "体験・相談",
  community: "コミュニティ",
  place: "場所・設備",
  activity: "活動の継続",
  other: "その他"
};

export const fundCampaignTypeLabels: Record<FundCampaignType, string> = {
  preorder: "先行購入",
  early_application: "先行申込",
  reservation: "参加予約",
  sponsorship: "協賛",
  support: "応援",
  interest: "興味登録"
};

export const fundProjectStatusLabels: Record<FundProjectStatus, string> = {
  draft: "下書き",
  interest_open: "興味受付中",
  ready: "募集準備中",
  open: "応援受付中",
  goal_reached: "目標達成",
  closed: "募集終了",
  in_progress: "制作・準備中",
  delivering: "提供中",
  completed: "完成",
  postponed: "延期",
  cancelled: "中止",
  archived: "アーカイブ"
};

export const fundVisibilityLabels: Record<FundVisibility, string> = {
  private: "非公開",
  unlisted: "限定URL（準備中）",
  public: "公開"
};

export const fundGoalTypeLabels: Record<FundGoalType, string> = {
  amount: "金額",
  supporters: "応援者",
  reservations: "予約",
  participants: "参加者",
  vendors: "出店者",
  sponsors: "協賛者"
};

export const fundGoalUnitLabels: Record<FundGoalType, string> = {
  amount: "円",
  supporters: "人",
  reservations: "件",
  participants: "人",
  vendors: "組",
  sponsors: "件"
};

export const fundPaymentStatusLabels: Record<FundPaymentStatus, string> = {
  unknown: "未確認",
  pending: "確認待ち",
  confirmed: "実行者確認済み",
  refunded: "返金済み",
  cancelled: "キャンセル"
};

export const fundFulfillmentStatusLabels: Record<FundFulfillmentStatus, string> = {
  not_required: "提供なし",
  waiting: "対応待ち",
  preparing: "準備中",
  scheduled: "提供予定",
  shipped: "発送済み",
  participated: "参加済み",
  in_service: "提供中",
  completed: "提供完了",
  on_hold: "対応保留",
  cancelled: "キャンセル"
};

export const fundSupportRecordStatusLabels: Record<FundSupportRecordStatus, string> = {
  valid: "有効",
  test: "テスト",
  duplicate: "重複",
  invalid: "無効"
};

export const fundTargetServiceLabels: Record<FundTargetService, { name: string; helper: string }> = {
  order: { name: "Order", helper: "依頼受付や制作へつなぐ" },
  item_studio: { name: "Item Studio", helper: "作品・商品として育てる" },
  event: { name: "Event", helper: "開催と申込管理へつなぐ" },
  session: { name: "Session", helper: "相談・予約メニューにする" },
  academy: { name: "Academy", helper: "講座・教材として育てる" },
  community: { name: "Community", helper: "会員モデル確定後の候補として残す" },
  team_works: { name: "Team Works", helper: "チーム運営へ引き継ぐ" }
};
