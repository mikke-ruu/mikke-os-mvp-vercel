export type SessionBookingStatus = "requested" | "confirmed" | "completed" | "cancelled";

export type SessionMenu = {
  id: string;
  ownerProfileId: string;
  title: string;
  summary: string;
  description: string;
  durationLabel: string;
  priceLabel: string;
  price: number | null;
  availabilityNote: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SessionBooking = {
  id: string;
  menuId: string;
  applicantName: string;
  contactEmail: string;
  contactNote: string;
  requestDetail: string;
  bookingDate: string;
  bookingTime: string;
  status: SessionBookingStatus;
  organizerMemo: string;
  createdAt: string;
  updatedAt: string;
};

export const sessionBookingStatusLabels: Record<SessionBookingStatus, string> = {
  requested: "申込",
  confirmed: "予約確定",
  completed: "実施済み",
  cancelled: "キャンセル"
};
