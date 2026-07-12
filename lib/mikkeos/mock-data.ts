import type { UnifiedActivityLog, UnifiedProfile } from "./types";

export const mockProfile: UnifiedProfile = {
  id: "profile-ayumi",
  displayName: "あゆみ",
  handle: "ayumi_musubi",
  brandName: "MUSUBI",
  area: "神奈川・東京",
  bio: "出店、講座、制作、相談、コミュニティ運営を横断して育てている活動者。mikkeOSでは、日々の活動をActivity Logに残し、StoryとDESKへ自然に流します。",
  createdAt: "2026-06-01T09:00:00.000Z"
};

export const mockActivityLogs: UnifiedActivityLog[] = [
  {
    id: "log-market-plan-001",
    profileId: mockProfile.id,
    appKey: "market_note",
    eventType: "market_event_created",
    title: "ミッケバザール淵野辺に出店予定",
    description: "出店予定、準備チェック、当日の持ち物をMarketNoteで管理します。",
    occurredAt: "2026-07-08T09:00:00.000Z",
    amountType: "none",
    sourceId: "market-fuchinobe-202607",
    visibility: "public",
    storyEnabled: true,
    deskEnabled: false,
    metadata: {
      location: "淵野辺",
      category: "出店",
      storySection: "出店履歴",
      sourceLabel: "出店予定"
    },
    createdAt: "2026-07-05T09:00:00.000Z"
  },
  {
    id: "log-event-001",
    profileId: mockProfile.id,
    appKey: "event",
    eventType: "event_created",
    title: "高円寺イベントを主催",
    description: "イベントページ、募集、出店者案内、開催レポートにつながる主催ログです。",
    occurredAt: "2026-07-10T10:00:00.000Z",
    amountType: "none",
    sourceId: "event-koenji-202607",
    visibility: "public",
    storyEnabled: true,
    deskEnabled: false,
    metadata: {
      location: "高円寺",
      category: "主催",
      storySection: "主催履歴",
      sourceLabel: "イベント作成"
    },
    createdAt: "2026-07-05T09:10:00.000Z"
  },
  {
    id: "log-order-001",
    profileId: mockProfile.id,
    appKey: "order",
    eventType: "order_received",
    title: "アイキャッチ制作を受注",
    description: "MIRACO由来の受注フローを、Orderの活動ログとして扱う想定です。",
    occurredAt: "2026-07-11T11:00:00.000Z",
    amount: 15000,
    amountType: "income",
    sourceId: "order-eyecatch-001",
    visibility: "public",
    storyEnabled: true,
    deskEnabled: true,
    metadata: {
      category: "受注",
      storySection: "受注実績",
      deskGroup: "受注売上",
      paymentStatus: "paid",
      sourceLabel: "受注"
    },
    createdAt: "2026-07-05T09:20:00.000Z"
  },
  {
    id: "log-item-001",
    profileId: mockProfile.id,
    appKey: "item_studio",
    eventType: "item_created",
    title: "ガラスアクセサリーを商品登録",
    description: "作品登録、写真、在庫、出品、販売実績へつながるItem Studioの入口です。",
    occurredAt: "2026-07-12T12:00:00.000Z",
    amountType: "none",
    sourceId: "item-glass-001",
    visibility: "public",
    storyEnabled: true,
    deskEnabled: false,
    metadata: {
      category: "作品",
      storySection: "作品",
      sourceLabel: "作品登録"
    },
    createdAt: "2026-07-05T09:30:00.000Z"
  },
  {
    id: "log-academy-001",
    profileId: mockProfile.id,
    appKey: "academy",
    eventType: "academy_course_created",
    title: "MUSUBI認定講座を開催",
    description: "講座作成、教材、受講者、認定、更新へつながるAcademyログです。",
    occurredAt: "2026-07-13T13:00:00.000Z",
    amount: 120000,
    amountType: "income",
    sourceId: "academy-musubi-basic",
    visibility: "public",
    storyEnabled: true,
    deskEnabled: true,
    metadata: {
      category: "講座",
      storySection: "講座",
      deskGroup: "講座売上",
      paymentStatus: "paid",
      sourceLabel: "講座開催"
    },
    createdAt: "2026-07-05T09:40:00.000Z"
  },
  {
    id: "log-session-001",
    profileId: mockProfile.id,
    appKey: "session",
    eventType: "session_booked",
    title: "個別相談セッションを実施",
    description: "予約、実施方法、決済、レビューへつながるSessionログです。",
    occurredAt: "2026-07-14T14:00:00.000Z",
    amount: 6000,
    amountType: "income",
    sourceId: "session-personal-001",
    visibility: "public",
    storyEnabled: true,
    deskEnabled: true,
    metadata: {
      category: "相談",
      storySection: "セッション",
      deskGroup: "セッション売上",
      paymentStatus: "paid",
      sourceLabel: "セッション"
    },
    createdAt: "2026-07-05T09:50:00.000Z"
  },
  {
    id: "log-community-001",
    profileId: mockProfile.id,
    appKey: "community",
    eventType: "community_post_created",
    title: "MUSUBIコミュニティにお知らせ投稿",
    description: "Academy内機能ではなく、独立したCommunityアプリからの活動ログです。",
    occurredAt: "2026-07-15T15:00:00.000Z",
    amountType: "none",
    sourceId: "community-news-001",
    visibility: "public",
    storyEnabled: true,
    deskEnabled: false,
    metadata: {
      category: "コミュニティ",
      storySection: "コミュニティ",
      sourceLabel: "お知らせ"
    },
    createdAt: "2026-07-05T10:00:00.000Z"
  },
  {
    id: "log-market-income-001",
    profileId: mockProfile.id,
    appKey: "market_note",
    eventType: "market_sales_recorded",
    title: "出店売上を記録",
    description: "ミッケバザール淵野辺の売上。DESKでは出店別利益に集計されます。",
    occurredAt: "2026-07-16T16:00:00.000Z",
    amount: 35000,
    amountType: "income",
    sourceId: "market-fuchinobe-sales",
    visibility: "private",
    storyEnabled: false,
    deskEnabled: true,
    metadata: {
      category: "出店売上",
      deskGroup: "出店売上",
      paymentStatus: "paid",
      sourceLabel: "売上"
    },
    createdAt: "2026-07-05T10:10:00.000Z"
  },
  {
    id: "log-market-expense-001",
    profileId: mockProfile.id,
    appKey: "market_note",
    eventType: "market_expense_recorded",
    title: "材料費を記録",
    description: "制作材料の経費。Storyには出さず、DESKの利益計算にだけ反映します。",
    occurredAt: "2026-07-16T17:00:00.000Z",
    amount: 8000,
    amountType: "expense",
    sourceId: "market-fuchinobe-materials",
    visibility: "private",
    storyEnabled: false,
    deskEnabled: true,
    metadata: {
      category: "材料費",
      deskGroup: "材料費",
      paymentStatus: "paid",
      sourceLabel: "経費"
    },
    createdAt: "2026-07-05T10:20:00.000Z"
  }
];

