import type { AppKey, MikkeAppDefinition } from "./types";

export const mikkeApps: MikkeAppDefinition[] = [
  {
    key: "market_note",
    name: "MarketNote",
    shortName: "Market",
    role: "出店予定、準備、売上、経費、振り返りを記録する入口。",
    status: "active",
    activityExamples: ["出店予定を作成", "出店売上を記録", "材料費を記録", "出店後の振り返り"],
    storyOutputs: ["出店履歴", "活動実績", "出店レポート"],
    deskOutputs: ["出店別売上", "出店別経費", "出店別利益"],
    accent: "terracotta"
  },
  {
    key: "event",
    name: "Event",
    shortName: "Event",
    role: "イベント主催、出店者募集、申込管理、開催レポートの入口。",
    status: "prototype",
    activityExamples: ["イベントを作成", "募集を開始", "出店者を承認", "イベントを終了"],
    storyOutputs: ["主催実績", "開催イベント一覧", "開催レポート"],
    deskOutputs: ["イベント売上", "会場費", "運営経費"],
    accent: "green"
  },
  {
    key: "order",
    name: "Order",
    shortName: "Order",
    role: "依頼受付、見積、支払い案内、制作、納品までを管理する入口。",
    status: "prototype",
    activityExamples: ["依頼を受付", "見積を作成", "支払いを確認", "納品を完了"],
    storyOutputs: ["納品実績", "制作実績", "お客様の声"],
    deskOutputs: ["受注売上", "未入金", "納品済み売上"],
    accent: "navy"
  },
  {
    key: "item_studio",
    name: "Item Studio",
    shortName: "Item",
    role: "作品、商品、在庫、出品、販売先を管理する入口。",
    status: "prototype",
    activityExamples: ["作品を登録", "在庫を追加", "商品を出品", "販売を記録"],
    storyOutputs: ["作品ポートフォリオ", "制作履歴", "販売実績"],
    deskOutputs: ["商品別売上", "在庫金額", "材料費"],
    accent: "gold"
  },
  {
    key: "academy",
    name: "Academy",
    shortName: "Academy",
    role: "講座、教材、受講、認定講師、キット注文を管理する入口。",
    status: "active",
    activityExamples: ["講座を作成", "受講申込を受付", "認定を完了", "更新を記録"],
    storyOutputs: ["講座実績", "認定実績", "講師プロフィール"],
    deskOutputs: ["講座売上", "教材売上", "更新料"],
    accent: "rose"
  },
  {
    key: "session",
    name: "Session",
    shortName: "Session",
    role: "相談、予約、レッスン、時間販売を管理する入口。",
    status: "prototype",
    activityExamples: ["相談メニューを作成", "予約を受付", "支払いを確認", "実施を記録"],
    storyOutputs: ["相談実績", "セッション実績", "レビュー"],
    deskOutputs: ["セッション売上", "未入金", "キャンセル"],
    accent: "blue"
  },
  {
    key: "community",
    name: "Community",
    shortName: "Community",
    role: "掲示板、お知らせ、会員、投稿、会費を管理する独立アプリ。",
    status: "planned",
    activityExamples: ["コミュニティを作成", "お知らせを投稿", "メンバー参加", "月会費を記録"],
    storyOutputs: ["運営コミュニティ", "投稿実績", "主催実績"],
    deskOutputs: ["月会費売上", "メンバー数", "継続率"],
    accent: "slate"
  },
  {
    key: "team_works",
    name: "Team Works",
    shortName: "Team",
    role: "学校・授業・パートナー・請求・報酬をチーム運営として管理する入口。",
    status: "active",
    activityExamples: ["授業を完了", "学校へ請求", "入金を確認", "パートナー報酬を記録"],
    storyOutputs: ["匿名化した活動実績", "運営実績", "チーム実績"],
    deskOutputs: ["学校請求", "学校入金", "パートナー報酬"],
    accent: "navy"
  },
  {
    key: "fund",
    name: "Fund",
    shortName: "Fund",
    role: "これから始めたい挑戦を公開し、応援、先行購入、参加予約を集める入口。",
    status: "prototype",
    activityExamples: ["支援ページを作成", "応援購入を受付", "支援金を記録", "リターン提供を管理"],
    storyOutputs: ["プロジェクト実績", "支援募集ページ", "活動報告"],
    deskOutputs: ["支援金", "リターン原価", "プロジェクト収支"],
    accent: "violet"
  },
  {
    key: "page",
    name: "Page",
    shortName: "Page",
    role: "会社・団体・ブランドのページを作り、既存アプリの活動を束ねて見せる入口。",
    status: "planned",
    activityExamples: ["ページ構成を作成", "CMSブロックを配置", "公開設定を準備", "掲載内容を見直し"],
    storyOutputs: ["団体ホームページ", "サービス紹介", "活動一覧"],
    deskOutputs: ["公開ページ別の反応", "申込導線", "後続フェーズでの成果確認"],
    accent: "slate"
  },
  {
    key: "library",
    name: "Library",
    shortName: "Library",
    role: "文章、メモ、URL、AI相談文、提出物の構成を整理する個人用の編集書庫。",
    status: "prototype",
    activityExamples: ["提出物の原案を作る", "AI文と整え文を比べる", "PageやAcademy用の説明文を準備する", "JSONバックアップを書き出す"],
    storyOutputs: [],
    deskOutputs: [],
    accent: "blue"
  }
];

// Academy is available only through its direct, authenticated routes for now.
// Keep it in the OS registry for Activity Log and app-internal lookups, but do
// not advertise it in the public app catalog or shared app menus.
const hiddenCatalogAppKeys = new Set<AppKey>(["academy"]);

export const catalogMikkeApps = mikkeApps.filter((app) => !hiddenCatalogAppKeys.has(app.key));

export const appByKey = mikkeApps.reduce<Record<AppKey, MikkeAppDefinition>>((acc, app) => {
  acc[app.key] = app;
  return acc;
}, {} as Record<AppKey, MikkeAppDefinition>);

export function getAppDefinition(key: AppKey) {
  return appByKey[key];
}
