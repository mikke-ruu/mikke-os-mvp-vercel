export type EventStatus = "draft" | "published" | "finished" | "cancelled";
export type ApplicationStatus = "submitted" | "reviewing" | "confirmed" | "declined" | "cancelled";
export type ApplicationPaymentStatus = "not_required" | "unpaid" | "paid";

export type MikkeEvent = {
  id: string;
  ownerProfileId: string;
  title: string;
  summary: string;
  description: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  venueName: string;
  venueAddress: string;
  mapUrl: string;
  coverImageUrl: string;
  feeLabel: string;
  feeAmount: number | null;
  capacity: number | null;
  applicationOpen: boolean;
  status: EventStatus;
  organizerNotice: string;
  createdAt: string;
  updatedAt: string;
};

export type EventApplication = {
  id: string;
  eventId: string;
  applicantName: string;
  contactEmail: string;
  phone: string;
  instagram: string;
  websiteUrl: string;
  genre: string;
  applicationNote: string;
  status: ApplicationStatus;
  organizerMemo: string;
  confirmedMemo: string;
  feeAmount: number | null;
  paymentStatus: ApplicationPaymentStatus;
  createdAt: string;
  updatedAt: string;
};

export const eventStatusLabels: Record<EventStatus, string> = {
  draft: "下書き",
  published: "公開中",
  finished: "終了",
  cancelled: "中止"
};

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  submitted: "受付済み",
  reviewing: "確認中",
  confirmed: "確定",
  declined: "見送り",
  cancelled: "キャンセル"
};

export const paymentStatusLabels: Record<ApplicationPaymentStatus, string> = {
  not_required: "不要",
  unpaid: "未払い",
  paid: "支払済"
};
