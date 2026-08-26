import assert from "node:assert/strict";
import { ICS_PREVIEW_LIMITS, buildIcsPreview, parseIcsCalendar } from "../lib/marketnote-ics-preview.mjs";

const mainFixture = `BEGIN:VCALENDAR
VERSION:2.0
X-WR-CALNAME:仕事の予定
BEGIN:VTIMEZONE
TZID:Asia/Tokyo
END:VTIMEZONE
BEGIN:VEVENT
UID:all-day@example.test
DTSTART;VALUE=DATE:20260809
DTEND;VALUE=DATE:20260810
SUMMARY:終日の予定
DESCRIPTION:画面に出してはいけない本文
ATTENDEE:mailto:secret@example.com
URL:https://meet.example.com/private
COMMENT:SECRET_COMMENT_VALUE
CONTACT:SECRET_CONTACT_VALUE
ORGANIZER:mailto:SECRET_ORGANIZER_VALUE@example.com
ATTACH:https://example.com/SECRET_ATTACHMENT_VALUE
CONFERENCE:SECRET_CONFERENCE_VALUE
EMAIL:SECRET_EMAIL_VALUE@example.com
BEGIN:VALARM
TRIGGER:SECRET_REMINDER_VALUE
END:VALARM
END:VEVENT
BEGIN:VEVENT
UID:repeat@example.test
DTSTART;TZID=Asia/Tokyo:20260803T100000
DTEND;TZID=Asia/Tokyo:20260803T110000
RRULE:FREQ=WEEKLY;COUNT=4;BYDAY=MO
EXDATE;TZID=Asia/Tokyo:20260810T100000
RDATE;TZID=Asia/Tokyo:20260807T100000
SUMMARY:毎週の予定
END:VEVENT
BEGIN:VEVENT
UID:repeat@example.test
RECURRENCE-ID;TZID=Asia/Tokyo:20260817T100000
DTSTART;TZID=Asia/Tokyo:20260817T100000
DTEND;TZID=Asia/Tokyo:20260817T110000
STATUS:CANCELLED
SUMMARY:取消予定
END:VEVENT
BEGIN:VEVENT
UID:duplicate@example.test
DTSTART:20260820T010000Z
DTEND:20260820T020000Z
SUMMARY:重複予定
END:VEVENT
BEGIN:VEVENT
UID:duplicate@example.test
DTSTART:20260820T010000Z
DTEND:20260820T020000Z
SUMMARY:重複予定
END:VEVENT
END:VCALENDAR`;

const calendar = parseIcsCalendar(mainFixture);
const preview = buildIcsPreview(calendar, { from: "2026-08-01", to: "2026-08-31" });

assert.equal(preview.calendarName, "仕事の予定");
assert.equal(preview.items.filter((item) => item.title === "毎週の予定").length, 3);
assert.deepEqual(
  preview.items.filter((item) => item.title === "毎週の予定").map((item) => item.dateKey),
  ["2026-08-03", "2026-08-07", "2026-08-24"]
);
assert.equal(preview.items.find((item) => item.title === "毎週の予定")?.startsAt, "2026-08-03T01:00:00.000Z");
assert.equal(preview.items.find((item) => item.title === "終日の予定")?.allDay, true);
assert.equal(preview.items.find((item) => item.title === "終日の予定")?.endsAt, "2026-08-10");
assert.equal(preview.items.find((item) => item.title === "取消予定")?.status, "cancelled");
assert.equal(preview.duplicateCount, 1);
assert.equal(JSON.stringify(preview).includes("secret@example.com"), false);
assert.equal(JSON.stringify(preview).includes("画面に出してはいけない本文"), false);
assert.equal(JSON.stringify(preview).includes("meet.example.com"), false);
for (const secret of [
  "SECRET_COMMENT_VALUE",
  "SECRET_CONTACT_VALUE",
  "SECRET_ORGANIZER_VALUE",
  "SECRET_ATTACHMENT_VALUE",
  "SECRET_CONFERENCE_VALUE",
  "SECRET_EMAIL_VALUE",
  "SECRET_REMINDER_VALUE"
]) {
  assert.equal(JSON.stringify(calendar).includes(secret), false);
  assert.equal(JSON.stringify(preview).includes(secret), false);
}

const unsupportedTimeZone = parseIcsCalendar(`BEGIN:VCALENDAR
BEGIN:VTIMEZONE
TZID:Custom/Office
END:VTIMEZONE
BEGIN:VEVENT
UID:custom-timezone
DTSTART;TZID=Custom/Office:20260801T090000
SUMMARY:独自timezone
END:VEVENT
END:VCALENDAR`);
const unsupportedTimeZonePreview = buildIcsPreview(unsupportedTimeZone, { from: "2026-08-01", to: "2026-08-31" });
assert.equal(unsupportedTimeZonePreview.items.length, 0);
assert.ok(unsupportedTimeZonePreview.warnings.some((warning) => warning.includes("独自VTIMEZONE")));

const unsupportedRecurrence = parseIcsCalendar(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:complex-rule
DTSTART;VALUE=DATE:20260801
RRULE:FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1
SUMMARY:複雑な繰り返し
END:VEVENT
END:VCALENDAR`);
const unsupportedRecurrencePreview = buildIcsPreview(unsupportedRecurrence, { from: "2026-08-01", to: "2026-12-31" });
assert.equal(unsupportedRecurrencePreview.items.length, 0);
assert.ok(unsupportedRecurrencePreview.warnings.some((warning) => warning.includes("BYSETPOS")));

const missingUidFixture = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260801T010000Z
DTEND:20260801T020000Z
SUMMARY:UIDなし予定 A
END:VEVENT
BEGIN:VEVENT
DTSTART:20260802T010000Z
DTEND:20260802T020000Z
SUMMARY:UIDなし予定 B
END:VEVENT
BEGIN:VEVENT
DTSTART:20260801T010000Z
DTEND:20260801T020000Z
SUMMARY:UIDなし予定 A
END:VEVENT
END:VCALENDAR`;
const missingUidPreview = buildIcsPreview(parseIcsCalendar(missingUidFixture), { from: "2026-08-01", to: "2026-08-31" });
const repeatedMissingUidPreview = buildIcsPreview(parseIcsCalendar(missingUidFixture), { from: "2026-08-01", to: "2026-08-31" });
assert.deepEqual(missingUidPreview.items.map((item) => item.title), ["UIDなし予定 A", "UIDなし予定 B"]);
assert.equal(missingUidPreview.duplicateCount, 1);
assert.equal(new Set(missingUidPreview.items.map((item) => item.uid)).size, 2);
assert.deepEqual(missingUidPreview.items.map((item) => item.id), repeatedMissingUidPreview.items.map((item) => item.id));

const invalidDates = parseIcsCalendar(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:invalid-date
DTSTART;VALUE=DATE:20260230
SUMMARY:存在しない日付
END:VEVENT
BEGIN:VEVENT
UID:invalid-time
DTSTART:20261301T250000Z
SUMMARY:存在しない日時
END:VEVENT
END:VCALENDAR`);
const invalidDatesPreview = buildIcsPreview(invalidDates, { from: "2026-01-01", to: "2026-12-31" });
assert.equal(invalidDatesPreview.items.length, 0);
assert.ok(invalidDatesPreview.warnings.some((warning) => warning.includes("読み取れない")));

const invalidRangePreview = buildIcsPreview(calendar, { from: "2026-09-01", to: "2026-08-01" });
assert.equal(invalidRangePreview.items.length, 0);
assert.ok(invalidRangePreview.warnings.some((warning) => warning.includes("選択期間")));
const impossibleRangePreview = buildIcsPreview(calendar, { from: "2026-02-30", to: "2026-08-01" });
assert.equal(impossibleRangePreview.items.length, 0);
assert.ok(impossibleRangePreview.warnings.some((warning) => warning.includes("選択期間")));

const massiveRecurrence = parseIcsCalendar(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:massive-daily
DTSTART;VALUE=DATE:20260101
RRULE:FREQ=DAILY;COUNT=999999
SUMMARY:大量の繰り返し
END:VEVENT
END:VCALENDAR`);
const massiveRecurrencePreview = buildIcsPreview(massiveRecurrence, { from: "2026-01-01", to: "2040-12-31" });
assert.equal(massiveRecurrencePreview.items.length, ICS_PREVIEW_LIMITS.maxOccurrences);
assert.ok(massiveRecurrencePreview.warnings.some((warning) => warning.includes("期間を狭めてください")));

const longScanRecurrence = parseIcsCalendar(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:long-scan-yearly
DTSTART;VALUE=DATE:19000101
RRULE:FREQ=YEARLY;COUNT=999
SUMMARY:長期間の繰り返し
END:VEVENT
END:VCALENDAR`);
const longScanPreview = buildIcsPreview(longScanRecurrence, { from: "2099-01-01", to: "2100-12-31" });
assert.ok(longScanPreview.warnings.some((warning) => warning.includes("期間を狭めてください")));

const excessiveEvents = Array.from({ length: ICS_PREVIEW_LIMITS.maxEvents + 3 }, (_, index) => `BEGIN:VEVENT
UID:event-${index}
DTSTART;VALUE=DATE:20260801
SUMMARY:予定 ${index}
END:VEVENT`).join("\n");
const excessiveCalendar = parseIcsCalendar(`BEGIN:VCALENDAR\n${excessiveEvents}\nEND:VCALENDAR`);
assert.equal(excessiveCalendar.events.length, ICS_PREVIEW_LIMITS.maxEvents);
assert.ok(excessiveCalendar.warnings.some((warning) => warning.includes("期間を狭めてください")));

console.log("MarketNote ICS preview contract: ok");
