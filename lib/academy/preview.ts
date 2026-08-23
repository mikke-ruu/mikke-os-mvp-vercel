import type {
  AcademyApplication,
  AcademyApplicationNotification,
  AcademyClass,
  AcademyClassInstructorRequest,
  AcademyCourse,
  AcademyHeadquarters,
  AcademyHeadquartersInvitation,
  AcademyHeadquartersMember,
  AcademyHeadquartersSettings,
  AcademyInstructor,
  AcademyInstructorAddress,
  AcademyInstructorPage,
  AcademyKitOrder,
  AcademyMaterial,
  AcademyProgram,
  AcademyProgramSection,
  AcademyProgramStep
} from "@/types/database";

export const ACADEMY_PREVIEW_IDS = {
  headquarters: "00000000-0000-4000-8000-000000000001",
  course: "00000000-0000-4000-8000-000000000101",
  courseDraft: "00000000-0000-4000-8000-000000000102",
  courseWorkshop: "00000000-0000-4000-8000-000000000103",
  courseInstructorSales: "00000000-0000-4000-8000-000000000104",
  instructor: "00000000-0000-4000-8000-000000000201",
  instructorDormant: "00000000-0000-4000-8000-000000000202",
  application: "00000000-0000-4000-8000-000000000301",
  applicationPaid: "00000000-0000-4000-8000-000000000302",
  class: "00000000-0000-4000-8000-000000000401",
  classRequest: "00000000-0000-4000-8000-000000000501",
  program: "00000000-0000-4000-8000-000000000601",
  section: "00000000-0000-4000-8000-000000000701",
  step: "00000000-0000-4000-8000-000000000801",
  material: "00000000-0000-4000-8000-000000000901",
  kitOrder: "00000000-0000-4000-8000-000000001001"
} as const;

const now = "2026-08-22T00:00:00.000Z";

export function isAcademyLocalReview() {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return false;
  const preview = new URLSearchParams(window.location.search).get("preview");
  return preview === "walkthrough" || preview === "dashboard";
}

export function assertAcademyWritable() {
  if (isAcademyLocalReview()) {
    throw new Error("ローカル確認中は保存・更新できません。本番データは変更されていません。");
  }
}

export const academyPreviewHeadquarters: AcademyHeadquarters = {
  id: ACADEMY_PREVIEW_IDS.headquarters,
  owner_user_id: "00000000-0000-4000-8000-000000009001",
  owner_profile_id: "00000000-0000-4000-8000-000000009002",
  name: "ローカル確認用Academy",
  handle: "local-preview",
  tagline: "学びを仕事につなげる認定講座",
  logo_url: null,
  hero_image_url: null,
  front_message: "講座の学び方、認定後の活動、講師へのサポートを一つずつ案内します。",
  main_color: "#ff5a3c",
  contact_email: "academy-preview@example.com",
  renewal_period_months: 12,
  next_instructor_number: 13,
  plan: "small",
  plan_started_at: "2026-08-01",
  default_payment_note: "申込後に振込先をご案内します。",
  is_active: true,
  front_blocks: [{ type: "text", text: "この表示はローカル確認用のサンプルです。" }],
  created_at: now,
  updated_at: now
};

const defaultFeatures = {
  stepLearning: true,
  materialLicenses: false,
  materialAssignments: false,
  applications: true,
  classes: true,
  kits: true,
  certification: true,
  renewal: true,
  subscriptions: false,
  publicCoursePage: true,
  portal: {
    learning: true,
    applications: true,
    classes: true,
    approvals: false,
    kits: true,
    procurement: true,
    credentials: true,
    subscription: false
  }
};

export const academyPreviewCourses: AcademyCourse[] = [
  {
    id: ACADEMY_PREVIEW_IDS.course,
    headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
    user_id: academyPreviewHeadquarters.owner_user_id,
    code: "BASIC-01",
    name: "はじめての認定講座",
    subtitle: "基礎から実践までを一つずつ",
    main_image_url: null,
    description: "受講者が基礎を学び、修了後に認定講師として活動できる講座です。",
    price: 33000,
    duration_text: "全4回・各90分",
    formats: ["online", "in_person"],
    certification_conditions: "全ステップ受講と最終課題の提出",
    can_do_after: "認定講師として指定講座を開催できます。",
    kit_contents: "テキスト・ワークシート",
    material_contents: "講師用進行ガイド・動画教材",
    faq: [{ q: "未経験でも参加できますか？", a: "はい。基礎から順に案内します。" }],
    application_form_fields: [],
    lp_blocks: [{ type: "heading", text: "一歩ずつ身につく認定講座" }],
    accept_at_honbu: true,
    accept_at_koushi: true,
    is_published: true,
    payment_url: null,
    payment_provider: "manual",
    kit_price: 5500,
    kit_payment_url: null,
    requires_kit: true,
    feature_settings: defaultFeatures,
    sort_order: 1,
    created_at: now,
    updated_at: now
  },
  {
    id: ACADEMY_PREVIEW_IDS.courseDraft,
    headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
    user_id: academyPreviewHeadquarters.owner_user_id,
    code: "ONLINE-02",
    name: "オンライン実践講座",
    subtitle: "デジタル教材で学ぶ短期講座",
    main_image_url: null,
    description: "公開準備中の講座サンプルです。",
    price: 11000,
    duration_text: "120分",
    formats: ["online"],
    certification_conditions: null,
    can_do_after: "自分の活動計画を整理できます。",
    kit_contents: null,
    material_contents: null,
    faq: [],
    application_form_fields: [],
    lp_blocks: [],
    accept_at_honbu: true,
    accept_at_koushi: false,
    is_published: false,
    payment_url: null,
    payment_provider: "manual",
    kit_price: 0,
    kit_payment_url: null,
    requires_kit: false,
    feature_settings: {
      ...defaultFeatures,
      stepLearning: false,
      materialLicenses: true,
      materialAssignments: false,
      kits: false,
      certification: false,
      renewal: false,
      portal: { ...defaultFeatures.portal, learning: true, applications: false, kits: false, procurement: false, credentials: false }
    },
    sort_order: 2,
    created_at: now,
    updated_at: now
  },
  {
    id: ACADEMY_PREVIEW_IDS.courseWorkshop,
    headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
    user_id: academyPreviewHeadquarters.owner_user_id,
    code: "WORKSHOP-03",
    name: "対面ワークショップ",
    subtitle: "教材なしの1日講座",
    main_image_url: null,
    description: "本部が申込を受け付け、開催日と参加者を管理する講座です。",
    price: 5500,
    duration_text: "120分",
    formats: ["in_person"],
    certification_conditions: null,
    can_do_after: "作品を1つ完成できます。",
    kit_contents: null,
    material_contents: "PDFテキスト・参考動画URL",
    faq: [],
    application_form_fields: [],
    lp_blocks: [],
    accept_at_honbu: true,
    accept_at_koushi: false,
    is_published: true,
    payment_url: null,
    payment_provider: "manual",
    kit_price: 0,
    kit_payment_url: null,
    requires_kit: false,
    feature_settings: {
      ...defaultFeatures,
      stepLearning: false,
      materialLicenses: false,
      materialAssignments: false,
      kits: false,
      certification: false,
      renewal: false,
      portal: { ...defaultFeatures.portal, learning: false, applications: false, kits: false, procurement: false, credentials: false }
    },
    sort_order: 3,
    created_at: now,
    updated_at: now
  },
  {
    id: ACADEMY_PREVIEW_IDS.courseInstructorSales,
    headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
    user_id: academyPreviewHeadquarters.owner_user_id,
    code: "PRO-04",
    name: "認定講師プログラム",
    subtitle: "認定後の講師活動までサポート",
    main_image_url: null,
    description: "本部と講師が申込を受け付け、認定後に営業・受注・キット発注を行う講座です。",
    price: 49800,
    duration_text: "全6回・各90分",
    formats: ["online"],
    certification_conditions: "全課程修了、本人の活動意思、指定コミュニティへの参加、本部承認",
    can_do_after: "認定講師として指定講座を紹介・受注できます。",
    kit_contents: "講座用テキスト・実習キット",
    material_contents: "現物教材と認定講師向けの共有資料",
    faq: [],
    application_form_fields: [],
    lp_blocks: [],
    accept_at_honbu: true,
    accept_at_koushi: true,
    is_published: true,
    payment_url: null,
    payment_provider: "manual",
    kit_price: 8800,
    kit_payment_url: null,
    requires_kit: true,
    feature_settings: { ...defaultFeatures, stepLearning: false, materialLicenses: true, materialAssignments: false },
    sort_order: 4,
    created_at: now,
    updated_at: now
  }
];

export const academyPreviewInstructors: AcademyInstructor[] = [
  {
    id: ACADEMY_PREVIEW_IDS.instructor,
    headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
    course_id: ACADEMY_PREVIEW_IDS.course,
    profile_id: "00000000-0000-4000-8000-000000009101",
    user_id: "00000000-0000-4000-8000-000000009102",
    instructor_number: "MIKKE-0012",
    certified_at: "2026-04-15",
    renewal_due: "2027-04-15",
    is_certified: true,
    is_active: true,
    registration_status: "registered",
    registered_at: "2026-04-15T00:00:00.000Z",
    withdrawn_at: null,
    withdrawn_by_user_id: null,
    status: "active",
    memo: "ローカル確認用の講師です。",
    photo_url: null,
    business_name: "みっけ学び教室",
    area: "東京都・オンライン",
    online_available: true,
    instagram_url: null,
    self_intro: "受講者のペースに合わせて、一つずつサポートします。",
    message: "一緒に楽しく学びましょう。",
    available_note: "平日午前・土曜日",
    accepts_applications: true,
    is_listed: true,
    display_on_story: false,
    payment_method_note: "申込後にお支払い方法をご案内します。",
    payment_url: null,
    payment_provider: "manual",
    created_at: now,
    updated_at: now
  },
  {
    id: ACADEMY_PREVIEW_IDS.instructorDormant,
    headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
    course_id: ACADEMY_PREVIEW_IDS.course,
    profile_id: "00000000-0000-4000-8000-000000009201",
    user_id: null,
    instructor_number: "MIKKE-0007",
    certified_at: "2025-02-01",
    renewal_due: "2026-09-01",
    is_certified: true,
    is_active: false,
    registration_status: "registered",
    registered_at: "2025-02-01T00:00:00.000Z",
    withdrawn_at: null,
    withdrawn_by_user_id: null,
    status: "dormant",
    memo: "活動休止中ですが、登録中のため料金集計には含まれます。",
    photo_url: null,
    business_name: "サンプル教室",
    area: "大阪府",
    online_available: false,
    instagram_url: null,
    self_intro: null,
    message: null,
    available_note: null,
    accepts_applications: false,
    is_listed: false,
    display_on_story: false,
    payment_method_note: null,
    payment_url: null,
    payment_provider: "manual",
    created_at: now,
    updated_at: now
  }
];

export const academyPreviewApplications: AcademyApplication[] = [
  {
    id: ACADEMY_PREVIEW_IDS.application,
    headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
    course_id: ACADEMY_PREVIEW_IDS.course,
    user_id: null,
    intake_source: "koushi",
    instructor_id: ACADEMY_PREVIEW_IDS.instructor,
    applicant_name: "山田 花子",
    applicant_email: "hanako@example.com",
    applicant_phone: "090-0000-0000",
    applicant_note: "土曜日の受講を希望しています。",
    form_answers: {},
    event_date: null,
    format: "online",
    price: 33000,
    kit_cost: 5500,
    honbu_revenue: 27500,
    instructor_revenue: 5500,
    status: "received",
    payment_status: "unpaid",
    payment_provider: "manual",
    provider_checkout_id: null,
    provider_checkout_url: null,
    provider_payment_id: null,
    paid_at: null,
    certification_status: "not_yet",
    display_on_story: false,
    reflect_on_desk: false,
    diploma_name_en: "HANAKO YAMADA",
    applicant_shipping_address: "東京都サンプル区1-2-3",
    community_interest: true,
    created_at: "2026-08-21T03:00:00.000Z",
    updated_at: now
  },
  {
    id: ACADEMY_PREVIEW_IDS.applicationPaid,
    headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
    course_id: ACADEMY_PREVIEW_IDS.course,
    user_id: null,
    intake_source: "honbu",
    instructor_id: null,
    applicant_name: "佐藤 美咲",
    applicant_email: "misaki@example.com",
    applicant_phone: null,
    applicant_note: null,
    form_answers: {},
    event_date: "2026-09-12",
    format: "in_person",
    price: 33000,
    kit_cost: 5500,
    honbu_revenue: 33000,
    instructor_revenue: 0,
    status: "scheduled",
    payment_status: "paid",
    payment_provider: "manual",
    provider_checkout_id: null,
    provider_checkout_url: null,
    provider_payment_id: null,
    paid_at: "2026-08-20T02:00:00.000Z",
    certification_status: "not_yet",
    display_on_story: false,
    reflect_on_desk: false,
    diploma_name_en: "MISAKI SATO",
    applicant_shipping_address: "神奈川県サンプル市4-5-6",
    community_interest: false,
    created_at: "2026-08-18T03:00:00.000Z",
    updated_at: now
  }
];

export const academyPreviewNotifications: AcademyApplicationNotification[] = [
  { recipient_kind: "applicant", status: "sent", last_error: null, sent_at: now, updated_at: now },
  { recipient_kind: "headquarters", status: "sent", last_error: null, sent_at: now, updated_at: now }
];

export const academyPreviewProgram: AcademyProgram = {
  id: ACADEMY_PREVIEW_IDS.program,
  headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
  course_id: ACADEMY_PREVIEW_IDS.course,
  title: "はじめての認定講座 プログラム",
  description: "受講から認定までの標準ステップ",
  status: "published",
  created_at: now,
  updated_at: now
};

export const academyPreviewSections: (AcademyProgramSection & { steps: AcademyProgramStep[] })[] = [
  {
    id: ACADEMY_PREVIEW_IDS.section,
    program_id: ACADEMY_PREVIEW_IDS.program,
    title: "基礎を学ぶ",
    sort_order: 1,
    created_at: now,
    updated_at: now,
    steps: [
      {
        id: ACADEMY_PREVIEW_IDS.step,
        section_id: ACADEMY_PREVIEW_IDS.section,
        step_type: "text",
        title: "Academyの目的を確認する",
        content: "講座の目的と、認定後にできることを確認します。",
        external_url: null,
        sort_order: 1,
        requires_previous: false,
        self_completion_allowed: true,
        created_at: now,
        updated_at: now
      }
    ]
  }
];

export const academyPreviewClasses: AcademyClass[] = [
  {
    id: ACADEMY_PREVIEW_IDS.class,
    headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
    course_id: ACADEMY_PREVIEW_IDS.course,
    program_id: ACADEMY_PREVIEW_IDS.program,
    program_version_id: "00000000-0000-4000-8000-000000000602",
    instructor_id: ACADEMY_PREVIEW_IDS.instructor,
    title: "2026年9月 オンライン開催",
    starts_at: "2026-09-12T01:00:00.000Z",
    ends_at: "2026-09-12T02:30:00.000Z",
    capacity: 8,
    venue_name: null,
    meeting_url: "https://example.com/meeting",
    schedule_mode: "fixed",
    registration_status: "open",
    format: "online",
    status: "planned",
    created_by_user_id: academyPreviewHeadquarters.owner_user_id,
    created_at: now,
    updated_at: now,
    course: { id: ACADEMY_PREVIEW_IDS.course, code: "BASIC-01", name: "はじめての認定講座" },
    instructor: {
      id: ACADEMY_PREVIEW_IDS.instructor,
      business_name: "みっけ学び教室",
      profile_id: academyPreviewInstructors[0].profile_id
    }
  }
];

export const academyPreviewClassRequests: AcademyClassInstructorRequest[] = [
  {
    id: ACADEMY_PREVIEW_IDS.classRequest,
    headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
    class_id: ACADEMY_PREVIEW_IDS.class,
    instructor_id: ACADEMY_PREVIEW_IDS.instructor,
    status: "requested",
    request_note: "この日程の担当をお願いできますか？",
    response_note: null,
    respond_by: "2026-08-30",
    requested_by_user_id: academyPreviewHeadquarters.owner_user_id,
    requested_at: now,
    responded_at: null,
    created_at: now,
    updated_at: now,
    class: { ...academyPreviewClasses[0], course: academyPreviewClasses[0].course },
    instructor: {
      id: ACADEMY_PREVIEW_IDS.instructor,
      business_name: "みっけ学び教室",
      profile_id: academyPreviewInstructors[0].profile_id,
      user_id: academyPreviewInstructors[0].user_id
    }
  }
];

export const academyPreviewMaterials: AcademyMaterial[] = [
  {
    id: ACADEMY_PREVIEW_IDS.material,
    headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
    course_id: ACADEMY_PREVIEW_IDS.course,
    user_id: academyPreviewHeadquarters.owner_user_id,
    kind: "pdf",
    title: "講師用進行ガイド",
    url: "https://example.com/academy-guide.pdf",
    description: "講座開催前に確認する進行資料です。",
    requires_active: true,
    is_published: true,
    sort_order: 1,
    created_at: now,
    updated_at: now
  }
];

export const academyPreviewKitOrders: AcademyKitOrder[] = [
  {
    id: ACADEMY_PREVIEW_IDS.kitOrder,
    headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
    course_id: ACADEMY_PREVIEW_IDS.course,
    instructor_id: ACADEMY_PREVIEW_IDS.instructor,
    user_id: academyPreviewInstructors[0].user_id,
    application_id: ACADEMY_PREVIEW_IDS.application,
    shipping_address: "東京都サンプル区1-2-3",
    desired_date: "2026-09-05",
    diploma_name_en: "HANAKO YAMADA",
    contact_email: "hanako@example.com",
    instructor_note: "受講日の1週間前までに発送希望",
    items: [{ name: "認定講座キット", qty: 1, unit_price: 5500 }],
    title: "はじめての認定講座 キット",
    amount: 5500,
    status: "preparing",
    payment_url: null,
    payment_status: "paid",
    ordered_at: "2026-08-21T03:00:00.000Z",
    created_at: now,
    updated_at: now
  }
];

export const academyPreviewAddresses: AcademyInstructorAddress[] = [
  {
    id: "00000000-0000-4000-8000-000000001101",
    instructor_id: ACADEMY_PREVIEW_IDS.instructor,
    label: "教室",
    address_text: "東京都サンプル区1-2-3 みっけ学び教室",
    created_at: now
  }
];

export const academyPreviewInstructorPage: AcademyInstructorPage = {
  id: "00000000-0000-4000-8000-000000001201",
  headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
  course_id: ACADEMY_PREVIEW_IDS.course,
  user_id: academyPreviewHeadquarters.owner_user_id,
  blocks: [
    { type: "heading", text: "認定講師スタートガイド" },
    { type: "text", text: "講座の振り返りと、初回開催までの準備を確認します。" },
    { type: "materials-list" }
  ],
  created_at: now,
  updated_at: now
};

export const academyPreviewSettings: AcademyHeadquartersSettings = {
  headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
  feature_flags: {},
  updated_by_user_id: academyPreviewHeadquarters.owner_user_id,
  created_at: now,
  updated_at: now
};

export const academyPreviewMembers: AcademyHeadquartersMember[] = [
  {
    id: "00000000-0000-4000-8000-000000001301",
    headquarters_id: ACADEMY_PREVIEW_IDS.headquarters,
    member_profile_id: "00000000-0000-4000-8000-000000001302",
    role: "administrator",
    status: "active",
    invited_by_user_id: academyPreviewHeadquarters.owner_user_id,
    accepted_at: now,
    stopped_at: null,
    created_at: now,
    updated_at: now,
    member: { id: "00000000-0000-4000-8000-000000001302", display_name: "運営スタッフ", handle: "academy_staff" }
  }
];

export const academyPreviewInvitations: AcademyHeadquartersInvitation[] = [];
