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

// =========================================================
// Academy（認定講座運営）Phase 0 スキーマ対応型
// SQL: Mikke OS/Mikke_OS_Academy_追加SQL_2026-07-08.sql
// =========================================================

export type AcademyHeadquarters = {
  id: string;
  owner_user_id: string;
  owner_profile_id: string | null;
  name: string;
  handle: string;
  tagline: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  front_message: string | null;
  main_color: string | null;
  contact_email: string | null;
  renewal_period_months: number | null;
  next_instructor_number: number | null;
  plan: "small" | "standard" | "growth" | "pro" | "paused";
  plan_started_at: string | null;
  default_payment_note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AcademyFaqItem = { q: string; a: string };
export type AcademyFormField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "email" | "tel" | "select" | "checkbox";
  required: boolean;
  options?: string[];
};

// 講座LP・講師専用ページ共通: 画像グリッドの1枚
export type AcademyGalleryImage = { url: string; caption?: string };

// 講座LPのビルド式ブロック（MIRACOビルド式踏襲・ざっくり版）
// Wave C (AC-C1): 見出し/文章/画像に加え、画像+文章(2カラム)・画像グリッド・CTAを追加。
// 既存のheading/text/imageは変更しない（旧データがそのまま読み込める）。
export type AcademyLpBlock =
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "image"; url: string; caption?: string }
  | { type: "image-text"; imageUrl: string; heading?: string; text: string }
  | { type: "gallery"; images: AcademyGalleryImage[] }
  | { type: "cta"; heading: string; buttonLabel: string; buttonUrl: string };

// 講師専用ページ（本部が作る復習・共有ページ）のビルド式ブロック
// Wave C (AC-C2): image-text/gallery/ctaをLPと同じ形で追加。
// Wave C (AC-C3): materials-list（設定項目なし。この講座のacademy_materialsを自動表示）を追加。
// 既存のheading/text/image/video/linksは変更しない（旧データがそのまま読み込める）。
export type AcademyPageLink = { label: string; url: string };
export type AcademyPageBlock =
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "image"; url: string; caption?: string }
  | { type: "video"; url: string; caption?: string }
  | { type: "links"; title?: string; items: AcademyPageLink[] }
  | { type: "image-text"; imageUrl: string; heading?: string; text: string }
  | { type: "gallery"; images: AcademyGalleryImage[] }
  | { type: "cta"; heading: string; buttonLabel: string; buttonUrl: string }
  | { type: "materials-list" };

export type AcademyInstructorPage = {
  id: string;
  headquarters_id: string;
  course_id: string;
  user_id: string;
  blocks: AcademyPageBlock[];
  created_at: string;
  updated_at: string;
};

export type AcademyCourse = {
  id: string;
  headquarters_id: string;
  user_id: string;
  code: string;
  name: string;
  subtitle: string | null;
  main_image_url: string | null;
  description: string | null;
  price: number;
  duration_text: string | null;
  formats: ("in_person" | "online")[];
  certification_conditions: string | null;
  can_do_after: string | null;
  kit_contents: string | null;
  material_contents: string | null;
  faq: AcademyFaqItem[];
  application_form_fields: AcademyFormField[];
  lp_blocks: AcademyLpBlock[];
  accept_at_honbu: boolean;
  accept_at_koushi: boolean;
  is_published: boolean;
  payment_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AcademyInstructor = {
  id: string;
  headquarters_id: string;
  course_id: string;
  profile_id: string;
  user_id: string | null;
  instructor_number: string | null;
  certified_at: string | null;
  renewal_due: string | null;
  is_certified: boolean;
  is_active: boolean;
  status: "active" | "dormant" | "suspended" | "reapplying";
  memo: string | null;
  photo_url: string | null;
  business_name: string | null;
  area: string | null;
  online_available: boolean;
  instagram_url: string | null;
  self_intro: string | null;
  message: string | null;
  available_note: string | null;
  accepts_applications: boolean;
  is_listed: boolean;
  display_on_story: boolean;
  created_at: string;
  updated_at: string;
};

export type AcademyApplicationStatus =
  | "received"
  | "awaiting_payment"
  | "paid"
  | "kit_pending"
  | "kit_preparing"
  | "kit_shipped"
  | "scheduled"
  | "completed"
  | "cert_pending"
  | "certified"
  | "instructor_added"
  | "closed"
  | "cancelled";

export type AcademyApplication = {
  id: string;
  headquarters_id: string;
  course_id: string;
  user_id: string;
  intake_source: "honbu" | "koushi";
  instructor_id: string | null;
  applicant_name: string;
  applicant_email: string | null;
  applicant_phone: string | null;
  applicant_note: string | null;
  form_answers: Record<string, unknown>;
  event_date: string | null;
  format: "in_person" | "online" | null;
  price: number;
  kit_cost: number;
  honbu_revenue: number;
  instructor_revenue: number;
  status: AcademyApplicationStatus;
  payment_status: "unpaid" | "paid" | "not_required";
  certification_status: "not_yet" | "pending" | "certified";
  display_on_story: boolean;
  reflect_on_desk: boolean;
  created_at: string;
  updated_at: string;
};

export type AcademyKitOrderItem = { name: string; qty: number; unit_price: number };

export type AcademyKitOrder = {
  id: string;
  headquarters_id: string;
  course_id: string | null;
  instructor_id: string;
  user_id: string | null;
  application_id: string | null;
  shipping_address: string | null;
  items: AcademyKitOrderItem[];
  title: string;
  amount: number;
  status:
    | "received"
    | "awaiting_payment"
    | "paid"
    | "preparing"
    | "shipped"
    | "closed"
    | "cancelled";
  payment_url: string | null;
  payment_status: "unpaid" | "paid" | "not_required";
  ordered_at: string;
  created_at: string;
  updated_at: string;
};

export type AcademyMaterial = {
  id: string;
  headquarters_id: string;
  course_id: string;
  user_id: string;
  kind: "pdf" | "video" | "link";
  title: string;
  url: string;
  description: string | null;
  requires_active: boolean;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// mikkeOS変換用ローカルイベントログ（本接続前の継ぎ目）
// 全体OS共有(2026-07-08): Academy操作を後からActivity Log化できる形で保持する
export type AcademyActivityEvent = {
  id: string;
  headquarters_id: string;
  actor_user_id: string | null;
  actor_profile_id: string | null;
  owner_user_id: string | null;
  event_type: string;
  course_id: string | null;
  lesson_id: string | null;
  enrollment_id: string | null;
  certification_id: string | null;
  material_id: string | null;
  application_id: string | null;
  kit_order_id: string | null;
  title: string | null;
  description: string | null;
  // 冪等キー（変換時 activity_logs.source_record_id へ）例: academy:course_sale:{application_id}
  idempotency_key: string | null;
  // 金額（activity_logs と同名で1:1写像）
  has_financial_value: boolean;
  amount: number | null;
  transaction_type: "revenue" | "expense" | "none";
  payment_status: "unpaid" | "paid" | "not_required";
  // 公開・集計の判定（activity_logs の判定項目に寄せる）
  visibility: "public" | "private" | "limited";
  display_on_story: boolean;
  display_in_timeline: boolean;
  display_as_achievement: boolean;
  counts_toward_summary: boolean;
  // 同期状態
  synced_to_activity_log: boolean;
  activity_log_id: string | null;
  occurred_at: string;
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

// =========================================================
// 認定講座構築サイト(nintei-koza-site) 問い合わせ・紹介・成約
// =========================================================

export type NinteiKozaTopic = "kobetsu" | "academy" | "community" | "textbook" | "other";
export type NinteiKozaInquiryStatus = "new" | "in_progress" | "won" | "lost" | "closed";

export type NinteiKozaInquiry = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  instagram: string | null;
  topic: NinteiKozaTopic;
  genre: string | null;
  prep_status: string | null;
  fund_interest: "yes" | "no" | "unknown" | null;
  message: string | null;
  source: string | null;
  referral: string | null;
  status: string;
};

export type NinteiKozaReferrer = {
  code: string;
  name: string;
  kind: "member" | "buyer" | "other";
  active: boolean;
  reward_textbook: boolean;
  reward_kobetsu: boolean;
  created_at: string;
  note: string | null;
};

export type NinteiKozaProduct = "textbook" | "kobetsu" | "academy" | "community";

export type NinteiKozaConversion = {
  id: string;
  created_at: string;
  inquiry_id: string | null;
  product: NinteiKozaProduct;
  amount: number | null;
  referral: string | null;
  reward_due: boolean;
  reward_done: boolean;
  reward_note: string | null;
  note: string | null;
};
