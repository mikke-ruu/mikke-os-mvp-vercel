const SENSITIVE_PROPERTY_NAMES = new Set([
  "ATTACH",
  "ATTENDEE",
  "COMMENT",
  "CONFERENCE",
  "CONTACT",
  "DESCRIPTION",
  "EMAIL",
  "ORGANIZER",
  "URL"
]);

const SUPPORTED_RRULE_KEYS = new Set([
  "BYDAY",
  "BYMONTH",
  "BYMONTHDAY",
  "COUNT",
  "FREQ",
  "INTERVAL",
  "UNTIL",
  "WKST"
]);

export const ICS_PREVIEW_LIMITS = Object.freeze({
  maxEvents: 5000,
  maxOccurrences: 2000,
  maxRecurrenceIterations: 50000
});

const PREVIEW_LIMIT_WARNING = "予定が多すぎます。期間を狭めてください。";

export function parseIcsCalendar(text) {
  const warnings = new Set();
  const lines = unfoldLines(String(text ?? ""));
  const rawEvents = [];
  const timeZoneIds = new Set();
  let calendarName = "Googleカレンダー";
  let currentEvent = null;
  let currentTimeZone = null;
  let alarmDepth = 0;
  let insideEvent = false;
  let eventCount = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const property = parseContentLine(lines[lineIndex], lineIndex + 1);
    if (!property) continue;

    if (property.name === "BEGIN" && property.value.toUpperCase() === "VALARM") {
      alarmDepth += 1;
      continue;
    }
    if (property.name === "END" && property.value.toUpperCase() === "VALARM") {
      alarmDepth = Math.max(0, alarmDepth - 1);
      continue;
    }
    if (alarmDepth > 0) continue;

    if (property.name === "BEGIN" && property.value.toUpperCase() === "VEVENT") {
      insideEvent = true;
      eventCount += 1;
      currentEvent = eventCount <= ICS_PREVIEW_LIMITS.maxEvents ? [] : null;
      if (eventCount > ICS_PREVIEW_LIMITS.maxEvents) warnings.add(PREVIEW_LIMIT_WARNING);
      continue;
    }
    if (property.name === "END" && property.value.toUpperCase() === "VEVENT") {
      if (currentEvent) rawEvents.push(parseEventProperties(currentEvent, warnings));
      currentEvent = null;
      insideEvent = false;
      continue;
    }
    if (property.name === "BEGIN" && property.value.toUpperCase() === "VTIMEZONE") {
      currentTimeZone = [];
      continue;
    }
    if (property.name === "END" && property.value.toUpperCase() === "VTIMEZONE") {
      const tzid = currentTimeZone?.find((entry) => entry.name === "TZID")?.value?.trim();
      if (tzid) timeZoneIds.add(tzid);
      currentTimeZone = null;
      continue;
    }

    if (insideEvent) {
      if (currentEvent && !SENSITIVE_PROPERTY_NAMES.has(property.name)) currentEvent.push(property);
      continue;
    }
    if (currentTimeZone) {
      currentTimeZone.push(property);
      continue;
    }
    if (property.name === "X-WR-CALNAME" && property.value.trim()) {
      calendarName = unescapeText(property.value.trim());
    }
  }

  const events = rawEvents.filter((event) => {
    if (event) return true;
    warnings.add("読み取れない予定を除外しました。");
    return false;
  });

  return {
    calendarName,
    events,
    timeZoneIds: [...timeZoneIds],
    warnings: [...warnings]
  };
}

export function buildIcsPreview(calendar, range) {
  const from = normalizeDateKey(range.from);
  const to = normalizeDateKey(range.to);
  if (!from || !to || from > to) {
    return {
      calendarName: calendar.calendarName,
      items: [],
      duplicateCount: 0,
      skippedCount: calendar.events.length,
      warnings: [...calendar.warnings, "選択期間を確認してください。"]
    };
  }

  const warnings = new Set(calendar.warnings);
  const grouped = new Map();
  for (const event of calendar.events) {
    const uid = event.uid || missingUid(event);
    if (!event.uid) warnings.add("UIDがない予定は、日時を使って重複を確認します。");
    const group = grouped.get(uid) ?? [];
    group.push(event);
    grouped.set(uid, group);
  }

  const items = [];
  let skippedCount = 0;
  let inputDuplicateCount = 0;
  const limitState = {
    remainingOccurrences: ICS_PREVIEW_LIMITS.maxOccurrences,
    remainingIterations: ICS_PREVIEW_LIMITS.maxRecurrenceIterations,
    reached: false
  };

  for (const [uid, group] of grouped) {
    if (limitState.reached || limitState.remainingOccurrences <= 0) {
      markPreviewLimit(limitState, warnings);
      break;
    }
    const exceptionByKey = new Map();
    const masters = [];
    for (const event of group) {
      if (event.recurrenceId) {
        const recurrence = resolveDateValue(event.recurrenceId, calendar.timeZoneIds, warnings);
        if (!recurrence) {
          skippedCount += 1;
          continue;
        }
        if (exceptionByKey.has(dateValueKey(recurrence))) inputDuplicateCount += 1;
        exceptionByKey.set(dateValueKey(recurrence), event);
      } else {
        masters.push(event);
      }
    }

    if (masters.length === 0) {
      for (const event of exceptionByKey.values()) {
        const item = eventToItem(uid, event, calendar, warnings);
        if (item && item.dateKey >= from && item.dateKey <= to && item.status !== "cancelled") {
          if (!takeOccurrence(limitState, warnings)) break;
          items.push(item);
        }
        else skippedCount += 1;
      }
      continue;
    }

    for (const master of masters) {
      if (master.status === "cancelled") {
        skippedCount += 1;
        continue;
      }
      const expanded = expandMaster(uid, master, calendar, from, to, warnings, limitState);
      if (!expanded) {
        skippedCount += 1;
        continue;
      }
      for (const baseItem of expanded) {
        const exception = exceptionByKey.get(baseItem.occurrenceKey);
        if (!exception) {
          items.push(baseItem);
          continue;
        }
        if (exception.status === "cancelled") {
          skippedCount += 1;
          continue;
        }
        const replacement = eventToItem(uid, exception, calendar, warnings, baseItem.occurrenceKey);
        if (replacement && replacement.dateKey >= from && replacement.dateKey <= to) items.push(replacement);
        else skippedCount += 1;
      }
    }
  }

  const uniqueItems = [];
  const seen = new Set();
  let duplicateCount = 0;
  for (const item of items.sort(comparePreviewItems)) {
    const key = `${item.uid}\u0000${item.occurrenceKey}`;
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(key);
    uniqueItems.push({ ...item, id: stableId(key) });
  }

  return {
    calendarName: calendar.calendarName,
    items: uniqueItems,
    duplicateCount: duplicateCount + inputDuplicateCount,
    skippedCount,
    warnings: [...warnings]
  };
}

function parseEventProperties(properties, warnings) {
  const first = (name) => properties.find((property) => property.name === name) ?? null;
  const many = (name) => properties.filter((property) => property.name === name);
  const start = first("DTSTART");
  if (!start) return null;

  const uid = first("UID")?.value?.trim() ?? "";
  const summary = unescapeText(first("SUMMARY")?.value?.trim() || "名称未設定の予定");
  const status = (first("STATUS")?.value || "CONFIRMED").trim().toUpperCase() === "CANCELLED" ? "cancelled" : "scheduled";

  if (many("RRULE").length > 1) warnings.add("複数のRRULEを持つ予定は最初の規則だけを確認します。");

  return {
    uid,
    title: summary,
    status,
    dtstart: toRawDateValue(start),
    dtend: first("DTEND") ? toRawDateValue(first("DTEND")) : null,
    duration: first("DURATION")?.value?.trim() ?? null,
    recurrenceId: first("RECURRENCE-ID") ? toRawDateValue(first("RECURRENCE-ID")) : null,
    rrule: first("RRULE")?.value?.trim() ?? null,
    rdates: many("RDATE").flatMap(toRawDateValues),
    exdates: many("EXDATE").flatMap(toRawDateValues)
  };
}

function expandMaster(uid, event, calendar, from, to, warnings, limitState) {
  const start = resolveDateValue(event.dtstart, calendar.timeZoneIds, warnings);
  if (!start) return null;
  const end = event.dtend ? resolveDateValue(event.dtend, calendar.timeZoneIds, warnings) : null;
  const duration = resolveDuration(start, end, event.duration, warnings);
  if (duration == null) return null;

  const exdateKeys = new Set();
  for (const raw of event.exdates) {
    const value = resolveDateValue(raw, calendar.timeZoneIds, warnings);
    if (value) exdateKeys.add(dateValueKey(value));
  }

  const starts = [];
  if (event.rrule) {
    const rule = parseRRule(event.rrule, warnings);
    if (!rule) return null;
    starts.push(...expandRule(start, rule, from, to, warnings, limitState));
  } else {
    starts.push(start);
  }

  for (const raw of event.rdates) {
    if (starts.length >= limitState.remainingOccurrences) {
      markPreviewLimit(limitState, warnings);
      break;
    }
    const value = resolveDateValue(raw, calendar.timeZoneIds, warnings);
    if (value) starts.push(value);
  }

  const result = [];
  for (const occurrenceStart of starts) {
    const occurrenceKey = dateValueKey(occurrenceStart);
    if (exdateKeys.has(occurrenceKey)) continue;
    const item = makeItem(uid, event, occurrenceStart, duration, occurrenceKey);
    if (item.dateKey >= from && item.dateKey <= to) {
      if (!takeOccurrence(limitState, warnings)) break;
      result.push(item);
    }
  }
  return result;
}

function eventToItem(uid, event, calendar, warnings, forcedOccurrenceKey) {
  const start = resolveDateValue(event.dtstart, calendar.timeZoneIds, warnings);
  if (!start) return null;
  const end = event.dtend ? resolveDateValue(event.dtend, calendar.timeZoneIds, warnings) : null;
  const duration = resolveDuration(start, end, event.duration, warnings);
  if (duration == null) return null;
  return makeItem(uid, event, start, duration, forcedOccurrenceKey || dateValueKey(start));
}

function makeItem(uid, event, start, duration, occurrenceKey) {
  const allDay = start.kind === "date";
  const endValue = addDuration(start, duration);
  return {
    id: "",
    uid,
    occurrenceKey,
    title: event.title,
    status: event.status,
    allDay,
    timeZone: start.timeZone,
    localTime: allDay ? null : `${String(start.localParts.hour).padStart(2, "0")}:${String(start.localParts.minute).padStart(2, "0")}`,
    dateKey: start.dateKey,
    startsAt: allDay ? start.dateKey : new Date(start.epochMs).toISOString(),
    endsAt: allDay ? endValue.dateKey : new Date(endValue.epochMs).toISOString()
  };
}

function resolveDuration(start, end, rawDuration, warnings) {
  if (end) {
    if (start.kind !== end.kind) {
      warnings.add("開始と終了の形式が異なる予定を除外しました。");
      return null;
    }
    return start.kind === "date"
      ? Math.max(0, differenceDays(start.dateKey, end.dateKey))
      : Math.max(0, end.epochMs - start.epochMs);
  }
  if (rawDuration) {
    const parsed = parseDuration(rawDuration, start.kind);
    if (parsed != null) return parsed;
    warnings.add("対応していないDURATIONを持つ予定を除外しました。");
    return null;
  }
  return start.kind === "date" ? 1 : 0;
}

function parseRRule(raw, warnings) {
  const values = {};
  for (const part of raw.split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    values[part.slice(0, index).toUpperCase()] = part.slice(index + 1).toUpperCase();
  }

  const unsupported = Object.keys(values).filter((key) => !SUPPORTED_RRULE_KEYS.has(key));
  if (unsupported.length) {
    warnings.add(`対応していない繰り返し条件（${unsupported.join("、")}）を持つ予定を除外しました。`);
    return null;
  }
  if (!new Set(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).has(values.FREQ)) {
    warnings.add("対応していない繰り返し頻度を持つ予定を除外しました。");
    return null;
  }
  if (values.BYDAY?.split(",").some((value) => /^[-+]?\d/.test(value))) {
    warnings.add("『第1月曜』などの複雑な繰り返し予定を除外しました。");
    return null;
  }
  const weekdayCodes = new Set(["SU", "MO", "TU", "WE", "TH", "FR", "SA"]);
  if (values.BYDAY?.split(",").some((value) => !weekdayCodes.has(value)) || (values.WKST && !weekdayCodes.has(values.WKST))) {
    warnings.add("曜日指定が不正な繰り返し予定を除外しました。");
    return null;
  }
  if (values.FREQ === "YEARLY" && values.BYDAY) {
    warnings.add("曜日指定の年次繰り返し予定を除外しました。");
    return null;
  }

  const interval = positiveInteger(values.INTERVAL, 1);
  const count = values.COUNT ? positiveInteger(values.COUNT, null) : null;
  if (values.COUNT && count == null) {
    warnings.add("COUNTが不正な繰り返し予定を除外しました。");
    return null;
  }

  return {
    freq: values.FREQ,
    interval,
    count,
    until: values.UNTIL || null,
    weekStart: values.WKST || "MO",
    byDay: values.BYDAY ? values.BYDAY.split(",") : [],
    byMonthDay: values.BYMONTHDAY ? values.BYMONTHDAY.split(",").map(Number) : [],
    byMonth: values.BYMONTH ? values.BYMONTH.split(",").map(Number) : []
  };
}

function expandRule(start, rule, from, to, warnings, limitState) {
  const hardStart = minDateKey(start.dateKey, from);
  const hardEnd = to;
  const until = rule.until ? resolveUntil(rule.until, start, warnings) : null;
  if (rule.until && !until) return [];

  const result = [];
  let matched = 0;
  let cursor = start.dateKey;
  const maxDate = maxDateKey(hardEnd, start.dateKey);

  while (cursor <= maxDate && result.length < limitState.remainingOccurrences) {
    if (limitState.remainingIterations <= 0) {
      markPreviewLimit(limitState, warnings);
      break;
    }
    limitState.remainingIterations -= 1;
    if (matchesRule(cursor, start.dateKey, rule)) {
      const occurrence = dateAtSameLocalTime(start, cursor, warnings);
      if (!occurrence) return [];
      if (until && compareDateValues(occurrence, until) > 0) break;
      matched += 1;
      if (cursor >= hardStart && cursor <= hardEnd) result.push(occurrence);
      if (rule.count && matched >= rule.count) break;
    }
    cursor = addDays(cursor, 1);
  }

  if (cursor <= maxDate && result.length >= limitState.remainingOccurrences) markPreviewLimit(limitState, warnings);
  return result;
}

function matchesRule(candidate, start, rule) {
  if (candidate < start) return false;
  const candidateParts = dateParts(candidate);
  const startParts = dateParts(start);
  const diffDays = differenceDays(start, candidate);
  const monthDiff = (candidateParts.year - startParts.year) * 12 + candidateParts.month - startParts.month;
  const weekday = weekdayCode(candidate);

  if (rule.byMonth.length && !rule.byMonth.includes(candidateParts.month)) return false;
  if (rule.byMonthDay.length && !rule.byMonthDay.includes(candidateParts.day)) return false;
  if (rule.byDay.length && !rule.byDay.includes(weekday)) return false;

  if (rule.freq === "DAILY") return diffDays % rule.interval === 0;
  if (rule.freq === "WEEKLY") {
    const requestedDays = rule.byDay.length ? rule.byDay : [weekdayCode(start)];
    return weekDifference(start, candidate, rule.weekStart) % rule.interval === 0 && requestedDays.includes(weekday);
  }
  if (rule.freq === "MONTHLY") {
    if (monthDiff % rule.interval !== 0) return false;
    if (!rule.byMonthDay.length && !rule.byDay.length) return candidateParts.day === startParts.day;
    return true;
  }
  if ((candidateParts.year - startParts.year) % rule.interval !== 0) return false;
  if (!rule.byMonth.length && candidateParts.month !== startParts.month) return false;
  if (!rule.byMonthDay.length && candidateParts.day !== startParts.day) return false;
  return true;
}

function resolveUntil(raw, start, warnings) {
  const value = resolveDateValue({ value: raw, params: {}, lineNumber: 0 }, [], warnings, start.timeZone);
  return value;
}

function resolveDateValue(raw, declaredTimeZones, warnings, fallbackTimeZone) {
  const value = raw.value.trim();
  const isDate = raw.params.VALUE?.toUpperCase() === "DATE" || /^\d{8}$/.test(value);
  if (isDate) {
    const dateKey = compactDateToKey(value);
    if (!dateKey) {
      warnings.add("日付形式を読み取れない予定を除外しました。");
      return null;
    }
    return { kind: "date", dateKey, timeZone: "floating" };
  }

  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z|[+-]\d{4})?$/);
  if (!match) {
    warnings.add("日時形式を読み取れない予定を除外しました。");
    return null;
  }

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0)
  };
  const dateKey = `${match[1]}-${match[2]}-${match[3]}`;
  if (!isValidDateKey(dateKey) || parts.hour > 23 || parts.minute > 59 || parts.second > 59) {
    warnings.add("日時形式を読み取れない予定を除外しました。");
    return null;
  }
  const suffix = match[7] || "";
  let epochMs;
  let timeZone;

  if (suffix === "Z") {
    epochMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    timeZone = "UTC";
  } else if (/^[+-]\d{4}$/.test(suffix)) {
    const sign = suffix[0] === "+" ? 1 : -1;
    const offsetMinutes = sign * (Number(suffix.slice(1, 3)) * 60 + Number(suffix.slice(3, 5)));
    epochMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - offsetMinutes * 60000;
    timeZone = `UTC${suffix.slice(0, 3)}:${suffix.slice(3)}`;
  } else {
    timeZone = raw.params.TZID || fallbackTimeZone || "";
    if (!timeZone) {
      warnings.add("timezoneがない時刻予定を除外しました。");
      return null;
    }
    if (!isSupportedTimeZone(timeZone)) {
      const label = declaredTimeZones.includes(timeZone) ? "独自VTIMEZONE" : "不明なTZID";
      warnings.add(`${label}の予定を除外しました。`);
      return null;
    }
    epochMs = zonedPartsToEpoch(parts, timeZone);
  }

  if (!Number.isFinite(epochMs)) {
    warnings.add("timezoneを変換できない予定を除外しました。");
    return null;
  }
  return { kind: "date-time", dateKey, epochMs, timeZone, localParts: parts };
}

function dateAtSameLocalTime(start, dateKey, warnings) {
  if (start.kind === "date") return { ...start, dateKey };
  const date = dateParts(dateKey);
  const parts = { ...start.localParts, ...date };
  const epochMs = start.timeZone === "UTC"
    ? Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    : start.timeZone.startsWith("UTC+") || start.timeZone.startsWith("UTC-")
      ? start.epochMs + differenceDays(start.dateKey, dateKey) * 86400000
      : zonedPartsToEpoch(parts, start.timeZone);
  if (!Number.isFinite(epochMs)) {
    warnings.add("繰り返し予定のtimezoneを変換できませんでした。");
    return null;
  }
  return { ...start, dateKey, epochMs, localParts: parts };
}

function addDuration(start, duration) {
  if (start.kind === "date") return { ...start, dateKey: addDays(start.dateKey, duration) };
  return { ...start, epochMs: start.epochMs + duration };
}

function parseDuration(value, kind) {
  const match = value.match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match) return null;
  const days = Number(match[1] || 0) * 7 + Number(match[2] || 0);
  const milliseconds = ((days * 24 + Number(match[3] || 0)) * 60 + Number(match[4] || 0)) * 60000 + Number(match[5] || 0) * 1000;
  return kind === "date" ? days : milliseconds;
}

function parseContentLine(line, lineNumber = 0) {
  const colon = findDelimiter(line, ":");
  if (colon <= 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segments = splitOutsideQuotes(head, ";");
  const name = segments.shift()?.toUpperCase();
  if (!name) return null;
  const params = {};
  for (const segment of segments) {
    const equals = segment.indexOf("=");
    if (equals <= 0) continue;
    params[segment.slice(0, equals).toUpperCase()] = segment.slice(equals + 1).replace(/^"|"$/g, "");
  }
  return { name, params, value, lineNumber };
}

function unfoldLines(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const result = [];
  for (const line of normalized.split("\n")) {
    if (/^[ \t]/.test(line) && result.length) result[result.length - 1] += line.slice(1);
    else result.push(line);
  }
  return result;
}

function toRawDateValue(property) {
  return { value: property.value, params: property.params, lineNumber: property.lineNumber };
}

function toRawDateValues(property) {
  return splitOutsideQuotes(property.value, ",").map((value) => ({ value, params: property.params, lineNumber: property.lineNumber }));
}

function unescapeText(value) {
  return value.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function findDelimiter(value, delimiter) {
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"') quoted = !quoted;
    else if (!quoted && value[index] === delimiter) return index;
  }
  return -1;
}

function splitOutsideQuotes(value, delimiter) {
  const result = [];
  let current = "";
  let quoted = false;
  for (const character of value) {
    if (character === '"') quoted = !quoted;
    if (character === delimiter && !quoted) {
      result.push(current);
      current = "";
    } else current += character;
  }
  result.push(current);
  return result;
}

function missingUid(event) {
  const fingerprint = [
    normalizeFingerprintText(event.title),
    rawDateFingerprint(event.dtstart),
    rawDateFingerprint(event.dtend),
    normalizeFingerprintText(event.duration),
    rawDateFingerprint(event.recurrenceId),
    normalizeFingerprintText(event.rrule)
  ].join("\u0000");
  return `missing:${stableId(fingerprint)}`;
}

function rawDateFingerprint(raw) {
  if (!raw) return "";
  return [
    normalizeFingerprintText(raw.params?.VALUE),
    normalizeFingerprintText(raw.params?.TZID),
    normalizeFingerprintText(raw.value)
  ].join("|");
}

function normalizeFingerprintText(value) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ja");
}

function takeOccurrence(limitState, warnings) {
  if (limitState.remainingOccurrences <= 0) {
    markPreviewLimit(limitState, warnings);
    return false;
  }
  limitState.remainingOccurrences -= 1;
  return true;
}

function markPreviewLimit(limitState, warnings) {
  limitState.reached = true;
  warnings.add(PREVIEW_LIMIT_WARNING);
}

function normalizeDateKey(value) {
  return isValidDateKey(value) ? value : null;
}

function compactDateToKey(value) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return null;
  const dateKey = `${match[1]}-${match[2]}-${match[3]}`;
  return isValidDateKey(dateKey) ? dateKey : null;
}

function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateParts(value) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function addDays(value, amount) {
  const parts = dateParts(value);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return date.toISOString().slice(0, 10);
}

function differenceDays(from, to) {
  const a = dateParts(from);
  const b = dateParts(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000);
}

function weekdayCode(value) {
  const codes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const parts = dateParts(value);
  return codes[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()];
}

function weekDifference(from, to, weekStartCode) {
  const codes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const weekStart = Math.max(0, codes.indexOf(weekStartCode));
  function beginningOfWeek(value) {
    const parts = dateParts(value);
    const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
    return addDays(value, -((weekday - weekStart + 7) % 7));
  }
  return Math.floor(differenceDays(beginningOfWeek(from), beginningOfWeek(to)) / 7);
}

function dateValueKey(value) {
  return value.kind === "date" ? value.dateKey : new Date(value.epochMs).toISOString();
}

function compareDateValues(a, b) {
  if (a.kind === "date" && b.kind === "date") return a.dateKey.localeCompare(b.dateKey);
  if (a.kind === "date-time" && b.kind === "date-time") return a.epochMs - b.epochMs;
  return a.dateKey.localeCompare(b.dateKey);
}

function comparePreviewItems(a, b) {
  return a.dateKey.localeCompare(b.dateKey) || a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title, "ja");
}

function isSupportedTimeZone(timeZone) {
  if (timeZone === "UTC") return true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function zonedPartsToEpoch(parts, timeZone) {
  let guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const actual = partsInTimeZone(guess, timeZone);
    const desiredUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    guess += desiredUtc - actualUtc;
  }
  return guess;
}

function partsInTimeZone(epochMs, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const values = Object.fromEntries(formatter.formatToParts(new Date(epochMs)).map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  };
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function stableId(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `ics_${(hash >>> 0).toString(36)}`;
}

function minDateKey(a, b) {
  return a < b ? a : b;
}

function maxDateKey(a, b) {
  return a > b ? a : b;
}
