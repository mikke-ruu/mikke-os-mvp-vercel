const MAX_IMPORT_ITEMS = 2000;

export function buildGoogleManualImportRequest(calendarName, items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("取り込む予定を1件以上選んでください。");
  }
  if (items.length > MAX_IMPORT_ITEMS) {
    throw new Error("一度に取り込める予定は2000件までです。期間を狭めてください。");
  }

  const sourceLabel = normalizeText(calendarName || "Googleカレンダー", 80);
  const sourceCalendarKey = `ics_${stableHash(sourceLabel.normalize("NFKC").toLocaleLowerCase("ja"))}`;
  const seen = new Set();
  const payloadItems = items.map((item) => {
    const sourceRecordId = normalizeText(item.uid, 500);
    const occurrenceKey = normalizeText(item.occurrenceKey || "single", 200);
    const title = normalizeText(item.title || "名称未設定の予定", 200);
    const uniqueKey = `${sourceRecordId}\u0000${occurrenceKey}`;
    if (seen.has(uniqueKey)) throw new Error("同じ予定が重複しています。選択内容を確認してください。");
    seen.add(uniqueKey);

    if (item.allDay) {
      return {
        source_record_id: sourceRecordId,
        occurrence_key: occurrenceKey,
        title,
        all_day: true,
        time_zone: normalizeText(item.timeZone || "Asia/Tokyo", 100),
        starts_on: requireDateKey(item.startsAt),
        ends_on_exclusive: requireDateKey(item.endsAt),
        status: item.status === "cancelled" ? "cancelled" : "active"
      };
    }

    return {
      source_record_id: sourceRecordId,
      occurrence_key: occurrenceKey,
      title,
      all_day: false,
      time_zone: normalizeText(item.timeZone || "Asia/Tokyo", 100),
      starts_at: requireIsoDateTime(item.startsAt),
      ends_at: item.endsAt ? requireIsoDateTime(item.endsAt) : null,
      status: item.status === "cancelled" ? "cancelled" : "active"
    };
  });

  return {
    sourceCalendarKey,
    sourceLabel,
    items: payloadItems
  };
}

function normalizeText(value, maxLength) {
  const normalized = String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!normalized) throw new Error("予定の識別情報を確認できませんでした。");
  return normalized.slice(0, maxLength);
}

function requireDateKey(value) {
  const normalized = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error("終日予定の日付を確認できませんでした。");
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new Error("終日予定の日付を確認できませんでした。");
  }
  return normalized;
}

function requireIsoDateTime(value) {
  const date = new Date(String(value ?? ""));
  if (!Number.isFinite(date.getTime())) throw new Error("予定時刻を確認できませんでした。");
  return date.toISOString();
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
