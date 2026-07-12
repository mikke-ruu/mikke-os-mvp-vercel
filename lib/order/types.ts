export type OrderApplicationStatus = "new" | "in_progress" | "delivered" | "declined";

export type OrderMenu = {
  id: string;
  ownerProfileId: string;
  title: string;
  summary: string;
  description: string;
  priceLabel: string;
  price: number | null;
  leadTimeLabel: string;
  recommendedFor: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OrderApplication = {
  id: string;
  menuId: string;
  applicantName: string;
  contactEmail: string;
  contactNote: string;
  requestDetail: string;
  desiredDueDate: string;
  status: OrderApplicationStatus;
  organizerMemo: string;
  deliveryNote: string;
  createdAt: string;
  updatedAt: string;
};

export const orderApplicationStatusLabels: Record<OrderApplicationStatus, string> = {
  new: "新規",
  in_progress: "対応中",
  delivered: "納品済み",
  declined: "見送り"
};
