import {
  BookOpenCheck,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  HandCoins,
  LayoutDashboard,
  LucideIcon,
  MessageCircle,
  ReceiptText,
  Route,
  Settings,
  UserRoundCheck,
  UsersRound
} from "lucide-react";

export type TeamWorksRole = "owner" | "manager" | "client_user" | "worker";

export type TeamWorksView =
  | "home"
  | "dashboard"
  | "clients"
  | "participants"
  | "sessions"
  | "workers"
  | "assignments"
  | "guides"
  | "reports"
  | "payouts"
  | "invoices"
  | "clientPortal"
  | "workerPortal";

export type LabelSettings = {
  clients: string;
  clientUsers: string;
  participants: string;
  services: string;
  sessions: string;
  workers: string;
  assignments: string;
  attendanceRecords: string;
  reports: string;
  guideTemplates: string;
  payouts: string;
  invoices: string;
};

export type TranslationScope = "front_site" | "forms" | "client_portal" | "client_messages" | "worker_portal" | "admin";

export type FeatureSettings = {
  frontSite: boolean;
  inquiry: boolean;
  scheduling: boolean;
  participantManagement: boolean;
  participantChart: boolean;
  rosterBasedAttendance: boolean;
  guideLibrary: boolean;
  guideProgressLink: boolean;
  procedureOnlyMode: boolean;
  assignment: boolean;
  clockInOut: boolean;
  reports: boolean;
  internalReportNotes: boolean;
  clientVisibleReportComment: boolean;
  payouts: boolean;
  invoices: boolean;
  clientPortal: boolean;
  workerPortal: boolean;
  partnerAvailability: boolean;
  inAppMessages: boolean;
  responsiveBuilder: boolean;
  translationDisplay: boolean;
  translationScopes: TranslationScope[];
  activityLogIntegration: boolean;
  deskIntegration: boolean;
  storyIntegration: boolean;
};

export type TeamWorksTemplate = {
  organizationId: string;
  templateKey: "japanese_conversation_training";
  templateFamily: "school";
  sourceService: "team_works";
  roleModel: Record<TeamWorksRole, string[]>;
  labelSettings: LabelSettings;
  featureSettings: FeatureSettings;
};

export type ClientStatus = "active" | "trial" | "paused";
export type WorkerStatus = "available" | "limited" | "inactive";
export type SessionStatus = "unassigned" | "assigned" | "completed" | "cancelled";
export type AttendanceStatus = "present" | "absent" | "late" | "makeup" | "unset";
export type AdminStatus = "draft" | "submitted" | "reviewed" | "needs_revision";

export type TeamWorksClient = {
  id: string;
  organizationId: string;
  name: string;
  contactName: string;
  contact: string;
  memo: string;
  status: ClientStatus;
  preferredLanguage: "ja" | "en" | "id" | "vi";
};

export type TeamWorksParticipant = {
  id: string;
  organizationId: string;
  clientId: string;
  name: string;
  level: string;
  cautions: string;
  memo: string;
  currentGuideItemId: string;
  lastGuideItemId: string;
  lastMemo: string;
  nextMemo: string;
};

export type TeamWorksWorker = {
  id: string;
  organizationId: string;
  name: string;
  availabilityStatus: WorkerStatus;
  availableDays: string[];
  rate: number;
  memo: string;
};

export type TeamWorksSession = {
  id: string;
  organizationId: string;
  clientId: string;
  participantId: string;
  className: string;
  startsAt: string;
  durationMinutes: number;
  zoomUrl: string;
  workerId: string;
  status: SessionStatus;
};

export type TeamWorksGuideItem = {
  id: string;
  organizationId: string;
  number: number;
  title: string;
  targetLevel: string;
  materialType?: "google_doc" | "pdf" | "word" | "excel" | "sheet" | "slide" | "internal";
  materialTitle?: string;
  materialUrl?: string;
  materialNote?: string;
  questions: string[];
  expressions: string[];
  cautions: string;
  genericUse: string;
};

export type AttendanceEntry = {
  id: string;
  organizationId: string;
  sessionId: string;
  participantId: string;
  status: AttendanceStatus;
  note: string;
};

export type TeamWorksReport = {
  id: string;
  organizationId: string;
  sessionId: string;
  participantId: string;
  guideItemId: string;
  attendanceStatus: AttendanceStatus;
  content: string;
  studentMood: string;
  nextMemo: string;
  internalNote: string;
  clientComment: string;
  adminStatus: AdminStatus;
};

export type PartnerAvailability = {
  id: string;
  organizationId: string;
  workerId: string;
  date: string;
  status: "available" | "unavailable";
  timeRange: string;
  memo: string;
};

export type TeamWorksMessage = {
  id: string;
  organizationId: string;
  role: "admin" | "client" | "worker";
  targetId: string;
  body: string;
  language: "ja" | "en" | "id" | "vi";
  createdAt: string;
};

export type TeamWorksState = {
  clients: TeamWorksClient[];
  participants: TeamWorksParticipant[];
  workers: TeamWorksWorker[];
  sessions: TeamWorksSession[];
  guideItems: TeamWorksGuideItem[];
  attendanceEntries: AttendanceEntry[];
  reports: TeamWorksReport[];
  partnerAvailability: PartnerAvailability[];
  messages: TeamWorksMessage[];
  clockedInSessionIds: string[];
};

export type TeamWorksViewConfig = {
  view: TeamWorksView;
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
};

export const teamWorksTemplate: TeamWorksTemplate = {
  organizationId: "org_rin_ring_demo",
  templateKey: "japanese_conversation_training",
  templateFamily: "school",
  sourceService: "team_works",
  roleModel: {
    owner: ["all"],
    manager: ["dashboard", "clients", "participants", "sessions", "assignments", "reports", "invoices", "settings"],
    client_user: ["clientPortal", "sessions", "participants", "attendanceRecords", "invoices", "messages"],
    worker: ["workerPortal", "sessions", "guides", "reports", "payouts", "messages"]
  },
  labelSettings: {
    clients: "学校",
    clientUsers: "学校担当者",
    participants: "生徒",
    services: "日本語会話授業",
    sessions: "授業スケジュール",
    workers: "会話パートナー",
    assignments: "シフト割当",
    attendanceRecords: "出席簿",
    reports: "授業報告",
    guideTemplates: "会話マニュアル",
    payouts: "パートナー報酬",
    invoices: "学校請求"
  },
  featureSettings: {
    frontSite: true,
    inquiry: true,
    scheduling: true,
    participantManagement: true,
    participantChart: true,
    rosterBasedAttendance: true,
    guideLibrary: true,
    guideProgressLink: true,
    procedureOnlyMode: false,
    assignment: true,
    clockInOut: true,
    reports: true,
    internalReportNotes: true,
    clientVisibleReportComment: true,
    payouts: true,
    invoices: true,
    clientPortal: true,
    workerPortal: true,
    partnerAvailability: true,
    inAppMessages: true,
    responsiveBuilder: true,
    translationDisplay: true,
    translationScopes: ["front_site", "forms", "client_portal", "client_messages"],
    activityLogIntegration: false,
    deskIntegration: false,
    storyIntegration: false
  }
};

export const teamWorksInitialState: TeamWorksState = {
  clients: [
    {
      id: "client_sakura",
      organizationId: "org_rin_ring_demo",
      name: "さくら日本語学校",
      contactName: "Pereraさん",
      contact: "perera@example.com",
      memo: "N4会話クラス。授業前日にZoom URLを共有します。",
      status: "active",
      preferredLanguage: "en"
    },
    {
      id: "client_hikari",
      organizationId: "org_rin_ring_demo",
      name: "ひかり日本語教室",
      contactName: "Sariさん",
      contact: "sari@example.com",
      memo: "N5基礎会話。学校担当者は日本語が少しだけ分かります。",
      status: "active",
      preferredLanguage: "id"
    }
  ],
  participants: [
    {
      id: "part_suzan",
      organizationId: "org_rin_ring_demo",
      clientId: "client_sakura",
      name: "スザンヌ",
      level: "N4",
      cautions: "聞き返しが多い時は、例文を短く区切る。",
      memo: "旅行や食べ物の話題だと話しやすい。",
      currentGuideItemId: "guide_006",
      lastGuideItemId: "guide_005",
      lastMemo: "テーマ5まで完了。好きな食べ物は話しやすかった。",
      nextMemo: "次はテーマ6。理由を一文で言う練習を入れる。"
    },
    {
      id: "part_ayu",
      organizationId: "org_rin_ring_demo",
      clientId: "client_hikari",
      name: "アユ",
      level: "N5",
      cautions: "早口にならない。ひらがなで補助すると理解しやすい。",
      memo: "朝の生活テーマに興味あり。",
      currentGuideItemId: "guide_003",
      lastGuideItemId: "guide_002",
      lastMemo: "テーマ2まで完了。自己紹介は短文なら言えた。",
      nextMemo: "次はテーマ3。時間表現をゆっくり確認する。"
    },
    {
      id: "part_mina",
      organizationId: "org_rin_ring_demo",
      clientId: "client_sakura",
      name: "ミナ",
      level: "N4",
      cautions: "分からない時に黙りやすいので、選択肢を出す。",
      memo: "学校生活の話題が得意。",
      currentGuideItemId: "guide_006",
      lastGuideItemId: "guide_005",
      lastMemo: "テーマ5。友だちとの予定を話せた。",
      nextMemo: "テーマ6で理由と感想を聞く。"
    }
  ],
  workers: [
    {
      id: "worker_hanako",
      organizationId: "org_rin_ring_demo",
      name: "佐藤 花子",
      availabilityStatus: "available",
      availableDays: ["月", "火", "水", "金"],
      rate: 2500,
      memo: "N4会話が得意。学校向けの丁寧な報告ができます。"
    },
    {
      id: "worker_ichiro",
      organizationId: "org_rin_ring_demo",
      name: "鈴木 一郎",
      availabilityStatus: "limited",
      availableDays: ["火", "木"],
      rate: 2300,
      memo: "N5基礎向け。夜時間帯のみ対応可能。"
    }
  ],
  sessions: [
    {
      id: "session_0709_1",
      organizationId: "org_rin_ring_demo",
      clientId: "client_sakura",
      participantId: "part_suzan",
      className: "クラスA",
      startsAt: "2026-07-09T13:00",
      durationMinutes: 60,
      zoomUrl: "https://zoom.example.com/rin-ring-0709-a",
      workerId: "worker_hanako",
      status: "assigned"
    },
    {
      id: "session_0709_2",
      organizationId: "org_rin_ring_demo",
      clientId: "client_hikari",
      participantId: "part_ayu",
      className: "クラスB",
      startsAt: "2026-07-09T15:00",
      durationMinutes: 60,
      zoomUrl: "https://zoom.example.com/rin-ring-0709-b",
      workerId: "",
      status: "unassigned"
    },
    {
      id: "session_0710_1",
      organizationId: "org_rin_ring_demo",
      clientId: "client_sakura",
      participantId: "part_mina",
      className: "クラスA",
      startsAt: "2026-07-10T13:00",
      durationMinutes: 60,
      zoomUrl: "https://zoom.example.com/rin-ring-0710-a",
      workerId: "worker_hanako",
      status: "assigned"
    }
  ],
  guideItems: [
    {
      id: "guide_001",
      organizationId: "org_rin_ring_demo",
      number: 1,
      title: "自己紹介",
      targetLevel: "N5",
      questions: ["お名前を教えてください。", "どこの国から来ましたか。", "好きなことは何ですか。"],
      expressions: ["私は____です。", "____から来ました。", "____が好きです。"],
      cautions: "最初は短く、相手が答えやすい質問から始める。",
      genericUse: "初回ヒアリング / 基本情報の確認"
    },
    {
      id: "guide_002",
      organizationId: "org_rin_ring_demo",
      number: 2,
      title: "学校生活",
      targetLevel: "N5",
      questions: ["学校は何時からですか。", "好きな授業は何ですか。", "休み時間に何をしますか。"],
      expressions: ["____時からです。", "____の授業が好きです。", "休み時間に____します。"],
      cautions: "単語だけでも肯定して、文に直して返す。",
      genericUse: "利用状況 / 日常業務の確認"
    },
    {
      id: "guide_003",
      organizationId: "org_rin_ring_demo",
      number: 3,
      title: "朝の生活",
      targetLevel: "N5",
      questions: ["何時に起きますか。", "朝ごはんを食べますか。", "学校までどうやって行きますか。"],
      expressions: ["____時に起きます。", "____を食べます。", "____で行きます。"],
      cautions: "時間表現はゆっくり確認する。",
      genericUse: "作業前確認 / 当日の流れ確認"
    },
    {
      id: "guide_004",
      organizationId: "org_rin_ring_demo",
      number: 4,
      title: "買い物",
      targetLevel: "N4",
      questions: ["よく何を買いますか。", "どこで買いますか。", "いくらぐらいですか。"],
      expressions: ["____を買います。", "____で買います。", "____円ぐらいです。"],
      cautions: "数字が苦手な場合は選択式にする。",
      genericUse: "料金 / 数量確認"
    },
    {
      id: "guide_005",
      organizationId: "org_rin_ring_demo",
      number: 5,
      title: "予定を話す",
      targetLevel: "N4",
      questions: ["週末は何をしますか。", "誰と行きますか。", "どこへ行きますか。"],
      expressions: ["____する予定です。", "____と行きます。", "____へ行きます。"],
      cautions: "未来の表現を自然に使えるようにする。",
      genericUse: "次回予定 / スケジュール確認"
    },
    {
      id: "guide_006",
      organizationId: "org_rin_ring_demo",
      number: 6,
      title: "理由を伝える",
      targetLevel: "N4",
      questions: ["どうしてそれが好きですか。", "どうして日本語を勉強していますか。", "理由を一つ教えてください。"],
      expressions: ["____からです。", "____ので、____です。", "理由は____です。"],
      cautions: "理由が出ない時は、選択肢を2つ出して選んでもらう。",
      genericUse: "判断理由 / 作業理由の確認"
    }
  ],
  attendanceEntries: [
    {
      id: "attendance_0709_1",
      organizationId: "org_rin_ring_demo",
      sessionId: "session_0709_1",
      participantId: "part_suzan",
      status: "present",
      note: "学校側で出席予定"
    },
    {
      id: "attendance_0709_2",
      organizationId: "org_rin_ring_demo",
      sessionId: "session_0709_1",
      participantId: "part_mina",
      status: "present",
      note: "5分交代で参加予定"
    }
  ],
  reports: [
    {
      id: "report_0709_1",
      organizationId: "org_rin_ring_demo",
      sessionId: "session_0709_1",
      participantId: "part_suzan",
      guideItemId: "guide_005",
      attendanceStatus: "present",
      content: "テーマ5まで実施。週末の予定を短文で言えました。",
      studentMood: "笑顔で参加。単語が出ない時も質問で返せました。",
      nextMemo: "次回はテーマ6。理由を一文で言う練習。",
      internalNote: "次回担当者は、選択肢を出してから理由を聞くとスムーズです。",
      clientComment: "本日も前向きに参加できました。次回は理由を伝える練習をします。",
      adminStatus: "submitted"
    }
  ],
  partnerAvailability: [
    {
      id: "availability_hanako_0710",
      organizationId: "org_rin_ring_demo",
      workerId: "worker_hanako",
      date: "2026-07-10",
      status: "available",
      timeRange: "13:00-17:00",
      memo: "午後対応できます。"
    }
  ],
  messages: [
    {
      id: "message_client_1",
      organizationId: "org_rin_ring_demo",
      role: "client",
      targetId: "client_sakura",
      body: "7/9の授業は通常どおり実施予定です。",
      language: "en",
      createdAt: "2026-07-08T10:00"
    }
  ],
  clockedInSessionIds: []
};

export const teamWorksViews: Record<TeamWorksView, TeamWorksViewConfig> = {
  home: {
    view: "home",
    title: "Team Works",
    eyebrow: "home",
    description: "今日の授業、未対応、チーム状況を確認できます。",
    icon: Route
  },
  dashboard: {
    view: "dashboard",
    title: "管理者ダッシュボード",
    eyebrow: "dashboard",
    description: "学校、授業、割当、報告、報酬をまとめて確認します。",
    icon: LayoutDashboard
  },
  clients: {
    view: "clients",
    title: "学校管理",
    eyebrow: "clients",
    description: "学校、担当者、連絡先、言語設定を管理します。",
    icon: Building2
  },
  participants: {
    view: "participants",
    title: "生徒カルテ",
    eyebrow: "participants",
    description: "生徒ごとの履歴、注意点、次のテーマを管理します。",
    icon: UsersRound
  },
  sessions: {
    view: "sessions",
    title: "授業スケジュール",
    eyebrow: "sessions",
    description: "授業日時、Zoom、担当パートナーを確認します。",
    icon: CalendarDays
  },
  workers: {
    view: "workers",
    title: "会話パートナー管理",
    eyebrow: "workers",
    description: "稼働状況、対応曜日、報酬単価を管理します。",
    icon: UserRoundCheck
  },
  assignments: {
    view: "assignments",
    title: "シフト割当",
    eyebrow: "assignments",
    description: "未割当の授業に担当者を割り当てます。",
    icon: ClipboardCheck
  },
  guides: {
    view: "guides",
    title: "テーマライブラリ",
    eyebrow: "guides",
    description: "トークテーマや業務マニュアルを管理します。",
    icon: BookOpenCheck
  },
  reports: {
    view: "reports",
    title: "授業報告",
    eyebrow: "reports",
    description: "出席状況、実施内容、次回メモを確認します。",
    icon: FileText
  },
  payouts: {
    view: "payouts",
    title: "パートナー報酬",
    eyebrow: "payouts",
    description: "実施回数、実施時間、報酬予定を確認します。",
    icon: HandCoins
  },
  invoices: {
    view: "invoices",
    title: "学校請求",
    eyebrow: "invoices",
    description: "学校別の実施数と請求元データを確認します。",
    icon: ReceiptText
  },
  clientPortal: {
    view: "clientPortal",
    title: "学校ポータル",
    eyebrow: "client portal",
    description: "スケジュール、生徒、出席簿、連絡を確認します。",
    icon: MessageCircle
  },
  workerPortal: {
    view: "workerPortal",
    title: "レッスン実施",
    eyebrow: "worker portal",
    description: "Zoom、出勤、名簿、会話ガイド、報告をここで行います。",
    icon: UserRoundCheck
  }
};

export const teamWorksNav = [
  { href: "/apps/team-works", label: "ホーム", view: "home" },
  { href: "/apps/team-works/dashboard", label: "ダッシュボード", view: "dashboard" },
  { href: "/apps/team-works/sessions", label: "授業", view: "sessions" },
  { href: "/apps/team-works/assignments", label: "割当", view: "assignments" },
  { href: "/apps/team-works/reports", label: "報告", view: "reports" },
  { href: "/apps/team-works/payouts", label: "報酬", view: "payouts" },
  { href: "/apps/team-works/portal/worker", label: "実施", view: "workerPortal" },
  { href: "/apps/team-works/clients", label: "学校", view: "clients" },
  { href: "/apps/team-works/participants", label: "カルテ", view: "participants" },
  { href: "/apps/team-works/workers", label: "パートナー", view: "workers" },
  { href: "/apps/team-works/guides", label: "テーマ", view: "guides" },
  { href: "/apps/team-works/invoices", label: "請求", view: "invoices" },
  { href: "/apps/team-works/portal/client", label: "学校画面", view: "clientPortal" }
] as const;

export const teamWorksSchemaPlan = [
  "organizations",
  "organization_members",
  "roles",
  "clients",
  "client_users",
  "participants",
  "participant_progress",
  "services",
  "sessions",
  "workers",
  "assignments",
  "attendance_records",
  "reports",
  "guide_templates",
  "guide_items",
  "partner_availability",
  "messages",
  "payouts",
  "invoices",
  "template_settings",
  "label_settings",
  "feature_settings",
  "translation_settings"
];

export function createTeamWorksId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function formatSessionTime(startsAt: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(startsAt));
}

export function statusLabel(status: ClientStatus | WorkerStatus | SessionStatus | AttendanceStatus | AdminStatus) {
  const labels: Record<string, string> = {
    active: "契約中",
    trial: "面談中",
    paused: "休止中",
    available: "稼働中",
    limited: "一部稼働",
    inactive: "停止中",
    unassigned: "未割当",
    assigned: "確定",
    completed: "完了",
    cancelled: "中止",
    present: "出席",
    absent: "欠席",
    late: "遅刻",
    makeup: "振替",
    unset: "未入力",
    draft: "下書き",
    submitted: "確認待ち",
    reviewed: "確認済み",
    needs_revision: "要確認"
  };
  return labels[status] ?? status;
}
