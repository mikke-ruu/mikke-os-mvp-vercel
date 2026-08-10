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
    id: "marketnote",
    source: "marketnote",
    title: "MarketNote",
    description: "出店予定と会計を、ログインなしですぐ記録できます。",
    url: "https://mikke-os.com/marketnote",
    actionLabel: "MarketNoteを開く",
    tone: "orange"
  },
  {
    id: "story",
    source: "story",
    title: "Story",
    description: "写真やリンクをまとめた、自分の名刺ページを作れます。",
    url: "https://mikke-os.com/story/start",
    actionLabel: "Storyをつくる",
    tone: "blue"
  },
  {
    id: "mikke-home",
    source: "mikke",
    title: "mikke",
    description: "使えるアプリをホームページでまとめて見られます。",
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

export const mikkeInstallGuideUrl = "https://mikke-os.com/install.html";

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
