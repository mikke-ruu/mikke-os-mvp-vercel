import { mockActivityLogs } from "./mock-data";
import type { AppKey, UnifiedActivityLog } from "./types";

export function listUnifiedActivityLogs() {
  return mockActivityLogs;
}

export function createMockActivityFromApp(appKey: AppKey, overrides: Partial<UnifiedActivityLog> = {}): UnifiedActivityLog {
  const now = new Date().toISOString();

  return {
    id: `mock-${appKey}-${Date.now()}`,
    profileId: "profile-ayumi",
    appKey,
    eventType: `${appKey}_created`,
    title: "サンプル活動",
    description: "次の段階で、各アプリの作成操作から追加される想定のActivity Logです。",
    occurredAt: now,
    amountType: "none",
    sourceId: `source-${Date.now()}`,
    visibility: "public",
    storyEnabled: true,
    deskEnabled: false,
    createdAt: now,
    ...overrides
  };
}

