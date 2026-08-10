export type MikkeShareSource = "mikke" | "marketnote" | "story" | "community";

export type MikkeShareTarget = {
  id: string;
  source: MikkeShareSource;
  title: string;
  description: string;
  url: string;
  actionLabel: string;
  tone: "blue" | "orange" | "pink";
};

export const mikkeShareTargets: MikkeShareTarget[] = [
  {
    id: "marketnote-use",
    source: "marketnote",
    title: "MarketNoteをすぐ使ってもらう",
    description: "ログインせずに、出店予定や会計の記録を始められます。",
    url: "https://mikke-os.com/marketnote",
    actionLabel: "MarketNoteを開く",
    tone: "orange"
  },
  {
    id: "marketnote-about",
    source: "marketnote",
    title: "MarketNoteをおすすめする",
    description: "どんなアプリか、使い方と一緒に紹介できます。",
    url: "https://mikke-os.com/#app-marketnote",
    actionLabel: "MarketNoteの説明を見る",
    tone: "orange"
  },
  {
    id: "story-start",
    source: "story",
    title: "Storyをつくってもらう",
    description: "写真やリンクをまとめた、自分の名刺ページを作る入口です。",
    url: "https://mikke-os.com/story/start",
    actionLabel: "Storyをつくる",
    tone: "blue"
  },
  {
    id: "story-about",
    source: "story",
    title: "Storyをおすすめする",
    description: "どんなページを作れるか、見本と一緒に紹介できます。",
    url: "https://mikke-os.com/#app-story",
    actionLabel: "Storyの説明を見る",
    tone: "blue"
  },
  {
    id: "mikke-home",
    source: "mikke",
    title: "mikkeのホームページを教える",
    description: "MarketNoteやStoryなど、使えるアプリをまとめて紹介します。",
    url: "https://mikke-os.com/",
    actionLabel: "ホームページを見る",
    tone: "pink"
  }
];

export function normalizeMikkeShareSource(value: string | null | undefined): MikkeShareSource {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "marketnote" || normalized === "story" || normalized === "community") return normalized;
  return "mikke";
}

export function shareSourceFromAppName(appName: string): MikkeShareSource {
  const normalized = appName.trim().toLowerCase().replace(/\s+/g, "");
  if (normalized === "marketnote") return "marketnote";
  if (normalized === "story") return "story";
  if (normalized === "community") return "community";
  return "mikke";
}

/**
 * LINE公式の外部ブラウザ指定。QR・URLコピー・OS共有にだけ使い、
 * 画面表示用の正規URLは書き換えない。
 */
export function getExternalBrowserShareUrl(value: string) {
  const url = new URL(value);
  url.searchParams.set("openExternalBrowser", "1");
  return url.toString();
}
