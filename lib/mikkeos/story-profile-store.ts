export type StoryProfileLink = {
  key: string;
  label: string;
  url: string;
};

export type StoryPortfolioItem = {
  id: string;
  source: "upload" | "item_studio";
  storagePath: string;
  imageUrl: string;
  caption: string;
};

export type StoryThemeKey = "blue" | "orange" | "green" | "yellow" | "pink";

export type StoryProfileView = {
  displayName: string;
  handle: string;
  role: string;
  area: string;
  bio: string;
  avatarUrl: string;
  avatarStoragePath: string;
  bannerUrl: string;
  bannerStoragePath: string;
  portfolio: StoryPortfolioItem[];
  themeKey: StoryThemeKey;
  tags: string[];
  status: string;
  websiteLabel: string;
  websiteUrl: string;
  shopLabel: string;
  shopUrl: string;
  sns: StoryProfileLink[];
  pickupText: string;
  isPublished: boolean;
};

export const storyProfileStorageKey = "mikkeos.story.profile.v3";
export const storyPublicOrigin = (process.env.NEXT_PUBLIC_STORY_PUBLIC_ORIGIN ?? "https://mikke-os.com").replace(/\/$/, "");

export const storySnsDefaults: StoryProfileLink[] = [
  { key: "line", label: "LINE", url: "" },
  { key: "instagram", label: "Instagram", url: "" },
  { key: "x", label: "X", url: "" },
  { key: "facebook", label: "Facebook", url: "" },
  { key: "tiktok", label: "TikTok", url: "" }
];

export const storyThemes: Record<StoryThemeKey, { label: string; accent: string; soft: string; ink: string }> = {
  blue: { label: "ブルー", accent: "#3f4eb5", soft: "#f5f7ff", ink: "#1b1b1f" },
  orange: { label: "オレンジ", accent: "#f75a3b", soft: "#fff7ed", ink: "#1b1b1f" },
  green: { label: "グリーン", accent: "#8bc7ad", soft: "#eff8f4", ink: "#1b1b1f" },
  yellow: { label: "イエロー", accent: "#ffd370", soft: "#fff9e8", ink: "#1b1b1f" },
  pink: { label: "ピンク", accent: "#f9d3d2", soft: "#fff4f4", ink: "#1b1b1f" }
};

export const defaultStoryProfile: StoryProfileView = {
  displayName: "",
  handle: "",
  role: "",
  area: "",
  bio: "",
  avatarUrl: "",
  avatarStoragePath: "",
  bannerUrl: "",
  bannerStoragePath: "",
  portfolio: [],
  themeKey: "blue",
  tags: [],
  status: "",
  websiteLabel: "Webサイト",
  websiteUrl: "",
  shopLabel: "ショップ",
  shopUrl: "",
  sns: storySnsDefaults,
  pickupText: "",
  isPublished: false
};

const reservedStoryHandles = new Set([
  "admin", "administrator", "api", "app", "apps", "auth", "dashboard", "edit", "help", "home",
  "login", "logout", "manager", "member", "members", "mikke", "mikke-id", "mikke-os", "mikkeos",
  "mikkeruu", "new", "official", "owner", "preview", "profile", "root", "settings", "staff", "start",
  "story", "support", "system"
]);

const reservedStoryPrefixes = ["admin-", "api-", "mikke-", "mikkeos-", "mikkeruu-", "official-", "system-"];

export function normalizeStoryHandle(value: string) {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Keep the original value when a malformed URL escape reaches this helper.
  }
  return decoded.trim().replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
}

export function isReservedStoryHandle(handle: string) {
  const normalized = normalizeStoryHandle(handle);
  return reservedStoryHandles.has(normalized) || reservedStoryPrefixes.some((prefix) => normalized.startsWith(prefix));
}

export function getStoryProfileValidationError(profile: StoryProfileView, forPublish: boolean) {
  if (!forPublish && !profile.handle) return "";
  if (!forPublish && !/^[a-z0-9_][a-z0-9_-]{2,29}$/.test(profile.handle)) return "mikke IDは3〜30文字の英小文字・数字・ハイフン・アンダースコアで入力してください。";
  if (!forPublish && isReservedStoryHandle(profile.handle)) return "このmikke IDは公式またはシステム用です。別のIDを選んでください。";
  if (!profile.displayName.trim()) return "表示名を入力してください。";
  if (!/^[a-z0-9_][a-z0-9_-]{2,29}$/.test(profile.handle)) return "mikke IDは3〜30文字の英小文字・数字・ハイフン・アンダースコアで入力してください。";
  if (isReservedStoryHandle(profile.handle)) return "このmikke IDは公式またはシステム用です。別のIDを選んでください。";
  const invalidLink = [profile.websiteUrl, profile.shopUrl, ...profile.sns.map((item) => item.url)].find((url) => url.trim() && !getSafeStoryLinkUrl(url));
  if (invalidLink) return "SNSとリンクは https:// または http:// から始まるURLを入力してください。";
  return "";
}

export function getStoryPublicUrl(handle: string) {
  return `${storyPublicOrigin}/story/@${normalizeStoryHandle(handle)}`;
}

export function getStoryAppPath(handle: string) {
  return `/story/@${normalizeStoryHandle(handle)}`;
}

export function getSafeStoryLinkUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function mergeSnsLinks(value: unknown): StoryProfileLink[] {
  const parsed = Array.isArray(value) ? value as StoryProfileLink[] : [];
  const fixed = storySnsDefaults.map((item) => parsed.find((candidate) => candidate.key === item.key) ?? item);
  return [...fixed, ...parsed.filter((item) => !storySnsDefaults.some((fixedItem) => fixedItem.key === item.key))];
}

export function loadStoryProfileDraft(): StoryProfileView {
  if (typeof window === "undefined") return defaultStoryProfile;
  const stored = window.localStorage.getItem(storyProfileStorageKey) ?? window.localStorage.getItem("mikkeos.story.profile.v2");
  if (!stored) return defaultStoryProfile;
  try {
    const parsed = JSON.parse(stored) as Partial<StoryProfileView>;
    return {
      ...defaultStoryProfile,
      ...parsed,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      sns: mergeSnsLinks(parsed.sns),
      portfolio: Array.isArray(parsed.portfolio) ? parsed.portfolio.slice(0, 6) : [],
      themeKey: parsed.themeKey && parsed.themeKey in storyThemes ? parsed.themeKey : "blue",
      websiteLabel: parsed.websiteLabel?.trim() || "Webサイト",
      shopLabel: parsed.shopLabel?.trim() || "ショップ"
    };
  } catch {
    return defaultStoryProfile;
  }
}

export function saveStoryProfileDraft(profile: StoryProfileView) {
  window.localStorage.setItem(storyProfileStorageKey, JSON.stringify(profile));
  window.dispatchEvent(new Event("mikkeos-story-profile-updated"));
}
