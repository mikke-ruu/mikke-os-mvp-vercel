import type { ManagerAppKey, ManagerSnapshot } from "./types";

export type ManagerAppSuggestion = {
  id: string;
  title: string;
  helper: string;
  href: string;
  reason: string;
};

const appHrefByKey: Partial<Record<ManagerAppKey, string>> = {
  marketnote: "/apps/market-note",
  order: "/apps/order",
  session: "/apps/session",
  event: "/apps/event",
  fund: "/apps/fund",
  team_works: "/apps/team-works",
  academy: "/apps/academy",
  item_studio: "/apps/item-studio"
};

const appNameByKey: Partial<Record<ManagerAppKey, string>> = {
  marketnote: "MarketNote",
  order: "Order",
  session: "Session",
  event: "Event",
  fund: "Fund",
  team_works: "Team Works",
  academy: "Academy",
  item_studio: "Item Studio"
};

export function collectManagerAppSuggestions(snapshot: ManagerSnapshot): ManagerAppSuggestion[] {
  const activeAppKeys = new Set<ManagerAppKey>([
    ...snapshot.schedules.map((item) => item.source.appKey),
    ...snapshot.tasks.map((item) => item.source.appKey),
    ...snapshot.progress.map((item) => item.source.appKey)
  ]);
  const suggestions: ManagerAppSuggestion[] = [];

  if (activeAppKeys.size > 0) {
    const nextApp = [...activeAppKeys].find((key) => key !== "manager" && appHrefByKey[key]);
    if (nextApp) {
      suggestions.push({
        id: `active:${nextApp}`,
        title: `${appNameByKey[nextApp]}を確認`,
        helper: "進行中の予定やタスクの元アプリを開きます。",
        href: appHrefByKey[nextApp] ?? "/apps",
        reason: "Managerに動きがあるアプリです"
      });
    }
  }

  if (activeAppKeys.has("marketnote") && !activeAppKeys.has("event")) {
    suggestions.push({
      id: "marketnote-to-event",
      title: "Eventも使えます",
      helper: "出店だけでなく、主催・募集・申込対応をしたい時の入口です。",
      href: "/apps/event",
      reason: "MarketNoteの予定が動いています"
    });
  }

  if (activeAppKeys.has("order") && !activeAppKeys.has("session")) {
    suggestions.push({
      id: "order-to-session",
      title: "Sessionも使えます",
      helper: "制作依頼とは別に、相談・予約・時間販売を受けたい時に使えます。",
      href: "/apps/session",
      reason: "Orderの対応が動いています"
    });
  }

  if (activeAppKeys.has("fund") && !activeAppKeys.has("team_works")) {
    suggestions.push({
      id: "fund-to-team-works",
      title: "Team Worksも候補です",
      helper: "支援後の制作・提供をチームで進める時の入口です。",
      href: "/apps/team-works",
      reason: "Fundのプロジェクトが進行しています"
    });
  }

  if (activeAppKeys.has("item_studio") && !activeAppKeys.has("order")) {
    suggestions.push({
      id: "item-studio-to-order",
      title: "Orderも使えます",
      helper: "作品を見た人から、制作依頼やオーダー相談を受けたい時に使えます。",
      href: "/apps/order",
      reason: "Item Studioの作品が動いています"
    });
  }

  if (activeAppKeys.has("event") && !activeAppKeys.has("team_works")) {
    suggestions.push({
      id: "event-to-team-works",
      title: "Team Worksも候補です",
      helper: "主催準備をスタッフや出店者と分担したい時に使えます。",
      href: "/apps/team-works",
      reason: "Eventの準備が動いています"
    });
  }

  if (activeAppKeys.has("academy") && !activeAppKeys.has("team_works")) {
    suggestions.push({
      id: "academy-to-team-works",
      title: "Team Worksも候補です",
      helper: "教材制作や講師との分担を、チームの仕事として進めたい時に使えます。",
      href: "/apps/team-works",
      reason: "Academyの運営が動いています"
    });
  }

  if (activeAppKeys.has("team_works") && !activeAppKeys.has("event")) {
    suggestions.push({
      id: "team-works-to-event",
      title: "Eventも使えます",
      helper: "チームで準備した企画を、募集や申込受付につなげたい時に使えます。",
      href: "/apps/event",
      reason: "Team Worksの案件が動いています"
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "apps-start",
      title: "アプリから始める",
      helper: "やりたいことに合わせて、まず使うアプリを選びます。",
      href: "/apps",
      reason: "Managerは作業入口ではなく、横断で見る場所です"
    });
  }

  return uniqueSuggestions(suggestions).slice(0, 3);
}

function uniqueSuggestions(suggestions: ManagerAppSuggestion[]) {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    if (seen.has(suggestion.id)) return false;
    seen.add(suggestion.id);
    return true;
  });
}
