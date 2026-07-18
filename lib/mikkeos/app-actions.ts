import type { ActivityActionPreset, AppKey, UnifiedActivityLog } from "./types";

export const appActionPresets: Record<AppKey, ActivityActionPreset[]> = {
  market_note: [
    {
      id: "market-plan",
      appKey: "market_note",
      label: "出店予定を追加",
      title: "ミッケバザール淵野辺に出店予定を追加",
      description: "出店予定、準備チェック、当日の持ち物をMarketNoteからActivity Logへ送ります。",
      eventType: "market_event_created",
      amountType: "none",
      visibility: "public",
      storyEnabled: true,
      deskEnabled: false,
      sourceLabel: "出店予定",
      storySection: "出店履歴"
    },
    {
      id: "market-sales",
      appKey: "market_note",
      label: "出店売上を記録",
      title: "出店売上を記録",
      description: "出店で発生した売上をDESKへ集計します。公開ページには出しません。",
      eventType: "market_sales_recorded",
      amount: 35000,
      amountType: "income",
      visibility: "private",
      storyEnabled: false,
      deskEnabled: true,
      sourceLabel: "売上",
      deskGroup: "出店売上"
    }
  ],
  event: [
    {
      id: "event-created",
      appKey: "event",
      label: "イベントを作成",
      title: "高円寺イベントを主催",
      description: "イベント作成、募集、出店者案内、開催レポートにつながる主催ログです。",
      eventType: "event_created",
      amountType: "none",
      visibility: "public",
      storyEnabled: true,
      deskEnabled: false,
      sourceLabel: "イベント作成",
      storySection: "主催履歴"
    },
    {
      id: "event-expense",
      appKey: "event",
      label: "会場費を記録",
      title: "イベント会場費を記録",
      description: "イベント運営で発生した会場費をDESKへ集計します。",
      eventType: "event_expense_recorded",
      amount: 18000,
      amountType: "expense",
      visibility: "private",
      storyEnabled: false,
      deskEnabled: true,
      sourceLabel: "経費",
      deskGroup: "イベント経費"
    }
  ],
  order: [
    {
      id: "order-received",
      appKey: "order",
      label: "受注を追加",
      title: "アイキャッチ制作を受注",
      description: "依頼受付から納品までをOrderの活動として残します。",
      eventType: "order_received",
      amount: 15000,
      amountType: "income",
      visibility: "public",
      storyEnabled: true,
      deskEnabled: true,
      sourceLabel: "受注",
      storySection: "受注実績",
      deskGroup: "受注売上"
    },
    {
      id: "order-delivered",
      appKey: "order",
      label: "納品を記録",
      title: "制作物の納品を完了",
      description: "納品実績としてStoryに表示できる活動ログです。",
      eventType: "order_delivered",
      amountType: "none",
      visibility: "public",
      storyEnabled: true,
      deskEnabled: false,
      sourceLabel: "納品",
      storySection: "納品実績"
    }
  ],
  item_studio: [
    {
      id: "item-created",
      appKey: "item_studio",
      label: "作品を登録",
      title: "ガラスアクセサリーを商品登録",
      description: "作品、写真、在庫、出品、販売実績につながるItem Studioの活動です。",
      eventType: "item_created",
      amountType: "none",
      visibility: "public",
      storyEnabled: true,
      deskEnabled: false,
      sourceLabel: "作品登録",
      storySection: "作品"
    },
    {
      id: "item-sold",
      appKey: "item_studio",
      label: "販売を記録",
      title: "ガラスアクセサリーを販売",
      description: "商品販売の売上をDESKへ集計し、販売実績としてStoryにも残します。",
      eventType: "item_sold",
      amount: 4800,
      amountType: "income",
      visibility: "public",
      storyEnabled: true,
      deskEnabled: true,
      sourceLabel: "販売",
      storySection: "販売実績",
      deskGroup: "商品売上"
    }
  ],
  academy: [
    {
      id: "academy-course",
      appKey: "academy",
      label: "講座を追加",
      title: "MUSUBI認定講座を開催",
      description: "講座作成、受講者、認定、更新につながるAcademyの活動です。",
      eventType: "academy_course_created",
      amount: 120000,
      amountType: "income",
      visibility: "public",
      storyEnabled: true,
      deskEnabled: true,
      sourceLabel: "講座開催",
      storySection: "講座",
      deskGroup: "講座売上"
    },
    {
      id: "academy-certified",
      appKey: "academy",
      label: "認定完了を記録",
      title: "認定講師の認定を完了",
      description: "講師育成や認定実績としてStoryに表示できる活動ログです。",
      eventType: "academy_certification_completed",
      amountType: "none",
      visibility: "public",
      storyEnabled: true,
      deskEnabled: false,
      sourceLabel: "認定完了",
      storySection: "認定実績"
    }
  ],
  session: [
    {
      id: "session-done",
      appKey: "session",
      label: "セッションを実施",
      title: "個別相談セッションを実施",
      description: "相談、予約、実施、レビューにつながるSessionの活動です。",
      eventType: "session_completed",
      amount: 6000,
      amountType: "income",
      visibility: "public",
      storyEnabled: true,
      deskEnabled: true,
      sourceLabel: "セッション",
      storySection: "セッション",
      deskGroup: "セッション売上"
    },
    {
      id: "session-review",
      appKey: "session",
      label: "レビューを追加",
      title: "相談セッションのレビューを受信",
      description: "信頼につながるレビューとしてStoryに表示できる活動ログです。",
      eventType: "session_review_received",
      amountType: "none",
      visibility: "public",
      storyEnabled: true,
      deskEnabled: false,
      sourceLabel: "レビュー",
      storySection: "レビュー"
    }
  ],
  community: [
    {
      id: "community-post",
      appKey: "community",
      label: "お知らせを投稿",
      title: "MUSUBIコミュニティにお知らせ投稿",
      description: "CommunityはAcademy内機能ではなく、独立した活動の入口として扱います。",
      eventType: "community_post_created",
      amountType: "none",
      visibility: "public",
      storyEnabled: true,
      deskEnabled: false,
      sourceLabel: "お知らせ",
      storySection: "コミュニティ"
    },
    {
      id: "community-fee",
      appKey: "community",
      label: "月会費を記録",
      title: "コミュニティ月会費を記録",
      description: "会員制コミュニティの月会費をDESKへ集計します。",
      eventType: "community_fee_recorded",
      amount: 9800,
      amountType: "income",
      visibility: "private",
      storyEnabled: false,
      deskEnabled: true,
      sourceLabel: "月会費",
      deskGroup: "コミュニティ売上"
    }
  ],
  team_works: [],
  fund: [],
  page: []
};

export function createActivityFromPreset(preset: ActivityActionPreset): UnifiedActivityLog {
  const now = new Date().toISOString();
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id: `local-${preset.id}-${unique}`,
    profileId: "profile-ayumi",
    appKey: preset.appKey,
    eventType: preset.eventType,
    title: preset.title,
    description: preset.description,
    occurredAt: now,
    amount: preset.amount,
    amountType: preset.amountType,
    sourceId: `local-${preset.id}-${unique}`,
    visibility: preset.visibility,
    storyEnabled: preset.storyEnabled,
    deskEnabled: preset.deskEnabled,
    countsTowardSummary: preset.countsTowardSummary,
    metadata: {
      sourceLabel: preset.sourceLabel,
      storySection: preset.storySection,
      deskGroup: preset.deskGroup,
      paymentStatus: preset.amountType === "none" ? "not_required" : "paid"
    },
    createdAt: now
  };
}
