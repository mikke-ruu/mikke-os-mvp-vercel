export type StoryProfileLink = {
  key: string;
  label: string;
  url: string;
};

export type StoryProfileView = {
  displayName: string;
  handle: string;
  role: string;
  area: string;
  bio: string;
  avatarUrl: string;
  tags: string[];
  status: string;
  websiteUrl: string;
  shopUrl: string;
  sns: StoryProfileLink[];
  pickupText: string;
  isPublished: boolean;
};

export const storyProfileStorageKey = "mikkeos.story.profile.v2";
export const storyPublicOrigin = (process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://app.mikke-os.com").replace(/\/$/, "");

export const defaultStoryProfile: StoryProfileView = {
  displayName: "",
  handle: "",
  role: "",
  area: "",
  bio: "",
  avatarUrl: "",
  tags: [],
  status: "",
  websiteUrl: "",
  shopUrl: "",
  sns: [{ key: "instagram", label: "Instagram", url: "" }],
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
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function isReservedStoryHandle(handle: string) {
  const normalized = normalizeStoryHandle(handle);
  return reservedStoryHandles.has(normalized) || reservedStoryPrefixes.some((prefix) => normalized.startsWith(prefix));
}

export function getStoryProfileValidationError(profile: StoryProfileView, forPublish: boolean) {
  if (!forPublish && !profile.handle) return "";
  if (!forPublish && !/^[a-z0-9][a-z0-9_-]{2,39}$/.test(profile.handle)) return "URL名は3〜40文字の英小文字・数字・ハイフン・アンダースコアで入力してください。";
  if (!forPublish && isReservedStoryHandle(profile.handle)) return "このURL名は公式またはシステム用に予約されています。別のURL名を選んでください。";
  if (!profile.displayName.trim()) return "表示名を入力してください。";
  if (!/^[a-z0-9][a-z0-9_-]{2,39}$/.test(profile.handle)) return "URL名は3〜40文字の英小文字・数字・ハイフン・アンダースコアで入力してください。";
  if (isReservedStoryHandle(profile.handle)) return "このURL名は公式またはシステム用に予約されています。別のURL名を選んでください。";
  if (!profile.role.trim() && !profile.bio.trim()) return "肩書きまたは自己紹介のどちらかを入力してください。";
  return "";
}

export function getStoryPublicUrl(handle: string) {
  return `${storyPublicOrigin}/story/${normalizeStoryHandle(handle)}`;
}

export function loadStoryProfileDraft(): StoryProfileView {
  if (typeof window === "undefined") return defaultStoryProfile;
  const stored = window.localStorage.getItem(storyProfileStorageKey);
  if (!stored) return defaultStoryProfile;

  try {
    const parsed = JSON.parse(stored) as Partial<StoryProfileView>;
    return {
      ...defaultStoryProfile,
      ...parsed,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      sns: Array.isArray(parsed.sns) ? parsed.sns : defaultStoryProfile.sns
    };
  } catch {
    return defaultStoryProfile;
  }
}

export function saveStoryProfileDraft(profile: StoryProfileView) {
  window.localStorage.setItem(storyProfileStorageKey, JSON.stringify(profile));
  window.dispatchEvent(new Event("mikkeos-story-profile-updated"));
}
