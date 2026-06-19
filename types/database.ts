export type Profile = {
  id: string;
  user_id: string;
  display_name: string;
  handle: string;
  bio: string | null;
  area: string | null;
  avatar_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  member_number: number | null;
  joined_at: string;
  created_at: string;
  updated_at: string;
};

export type MarketEvent = {
  id: string;
  user_id: string;
  profile_id: string;
  title: string;
  event_date: string;
  venue_name: string | null;
  area: string | null;
  genre: string | null;
  status: "planned" | "preparing" | "completed" | "cancelled";
  visibility: "public" | "private";
  display_on_story: boolean;
  public_note: string | null;
  private_note: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketCheckItem = {
  id: string;
  user_id: string;
  profile_id: string;
  market_event_id: string;
  title: string;
  is_done: boolean;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type MarketFinancialRecord = {
  id: string;
  user_id: string;
  profile_id: string;
  market_event_id: string | null;
  record_type: "revenue" | "expense";
  title: string;
  amount: number;
  occurred_at: string;
  category: string | null;
  payment_status: "unpaid" | "paid" | "not_required";
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketReflection = {
  id: string;
  user_id: string;
  profile_id: string;
  market_event_id: string;
  public_summary: string | null;
  private_note: string | null;
  good_points: string | null;
  next_actions: string | null;
  created_at: string;
  updated_at: string;
};

export type ActivityLog = {
  id: string;
  user_id: string;
  profile_id: string;
  activity_type: string;
  category: string;
  source_service: string;
  source_record_id: string;
  occurred_at: string;
  title: string;
  description: string | null;
  visibility: "public" | "private" | "limited";
  status: "draft" | "confirmed" | "completed" | "cancelled";
  display_on_story: boolean;
  display_in_timeline: boolean;
  display_as_achievement: boolean;
  counts_toward_summary: boolean;
  has_financial_value: boolean;
  amount: number | null;
  transaction_type: "revenue" | "expense" | "none";
  payment_status: "unpaid" | "paid" | "not_required";
  created_at: string;
  updated_at: string;
};
