import assert from "node:assert/strict";
import { buildGoogleManualImportRequest } from "../lib/marketnote-google-import-contract.mjs";

const timed = {
  id: "preview-1",
  uid: "uid-1@example.test",
  occurrenceKey: "2026-09-01T01:00:00.000Z",
  title: "  打ち合わせ  ",
  status: "scheduled",
  allDay: false,
  timeZone: "Asia/Tokyo",
  localTime: "10:00",
  dateKey: "2026-09-01",
  startsAt: "2026-09-01T01:00:00.000Z",
  endsAt: "2026-09-01T02:00:00.000Z"
};
const allDay = {
  ...timed,
  id: "preview-2",
  uid: "uid-2@example.test",
  occurrenceKey: "2026-09-02",
  title: "休み",
  allDay: true,
  localTime: null,
  dateKey: "2026-09-02",
  startsAt: "2026-09-02",
  endsAt: "2026-09-03"
};

const request = await buildGoogleManualImportRequest("仕事の予定@example.test", [timed, allDay]);
assert.equal(request.sourceCalendarKey, "ics_manual");
assert.equal(request.sourceLabel, "Googleカレンダー（手動取り込み）");
assert.match(request.items[0].source_record_id, /^uid_[0-9a-f]{64}$/);
assert.equal(request.items[0].source_record_id.includes("@"), false);
assert.deepEqual(request.items[0], {
  source_record_id: request.items[0].source_record_id,
  occurrence_key: "2026-09-01T01:00:00.000Z",
  title: "打ち合わせ",
  all_day: false,
  time_zone: "Asia/Tokyo",
  starts_at: "2026-09-01T01:00:00.000Z",
  ends_at: "2026-09-01T02:00:00.000Z",
  status: "active"
});
assert.deepEqual(request.items[1], {
  source_record_id: request.items[1].source_record_id,
  occurrence_key: "2026-09-02",
  title: "休み",
  all_day: true,
  time_zone: "Asia/Tokyo",
  starts_on: "2026-09-02",
  ends_on_exclusive: "2026-09-03",
  status: "active"
});

const serialized = JSON.stringify(request);
assert.equal(serialized.includes("uid-1@example.test"), false, "raw ICS UID must not be stored");
for (const forbidden of ["description", "attendee", "email", "meeting", "photo", "amount", "payment", "activity_log", "story"]) {
  assert.equal(serialized.includes(forbidden), false, `must not include ${forbidden}`);
}

await assert.rejects(() => buildGoogleManualImportRequest("仕事", []), /1件以上/);
await assert.rejects(() => buildGoogleManualImportRequest("仕事", [timed, timed]), /重複/);
await assert.rejects(() => buildGoogleManualImportRequest("仕事", [timed, { ...timed, uid: " uid-1@example.test " }]), /重複/);
await assert.rejects(() => buildGoogleManualImportRequest("仕事", [{ ...timed, startsAt: "invalid" }]), /予定時刻/);
await assert.rejects(() => buildGoogleManualImportRequest("仕事", Array.from({ length: 2001 }, (_, index) => ({
  ...timed,
  uid: `uid-${index}`,
  occurrenceKey: `occurrence-${index}`
}))), /2000件/);

const renamedCalendar = await buildGoogleManualImportRequest("名前変更後", [timed]);
assert.equal(renamedCalendar.sourceCalendarKey, request.sourceCalendarKey);
assert.equal(renamedCalendar.items[0].source_record_id, request.items[0].source_record_id);
const secondDigest = await buildGoogleManualImportRequest("仕事の予定", [{ ...timed, uid: "uid-2@example.test" }]);
assert.notEqual(secondDigest.items[0].source_record_id, request.items[0].source_record_id);
const longUidA = await buildGoogleManualImportRequest("仕事の予定", [{ ...timed, uid: `${"a".repeat(500)}x` }]);
const longUidB = await buildGoogleManualImportRequest("仕事の予定", [{ ...timed, uid: `${"a".repeat(500)}y` }]);
assert.notEqual(longUidA.items[0].source_record_id, longUidB.items[0].source_record_id);
const spacedUidA = await buildGoogleManualImportRequest("仕事の予定", [{ ...timed, uid: "series  one" }]);
const spacedUidB = await buildGoogleManualImportRequest("仕事の予定", [{ ...timed, uid: "series one" }]);
assert.notEqual(spacedUidA.items[0].source_record_id, spacedUidB.items[0].source_record_id);

console.log("MarketNote Google manual import contract: ok");
