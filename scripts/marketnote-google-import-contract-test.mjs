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

const request = buildGoogleManualImportRequest("仕事の予定", [timed, allDay]);
assert.match(request.sourceCalendarKey, /^ics_[a-z0-9]+$/);
assert.equal(request.sourceLabel, "仕事の予定");
assert.deepEqual(request.items[0], {
  source_record_id: "uid-1@example.test",
  occurrence_key: "2026-09-01T01:00:00.000Z",
  title: "打ち合わせ",
  all_day: false,
  time_zone: "Asia/Tokyo",
  starts_at: "2026-09-01T01:00:00.000Z",
  ends_at: "2026-09-01T02:00:00.000Z",
  status: "active"
});
assert.deepEqual(request.items[1], {
  source_record_id: "uid-2@example.test",
  occurrence_key: "2026-09-02",
  title: "休み",
  all_day: true,
  time_zone: "Asia/Tokyo",
  starts_on: "2026-09-02",
  ends_on_exclusive: "2026-09-03",
  status: "active"
});

const serialized = JSON.stringify(request);
for (const forbidden of ["description", "attendee", "email", "meeting", "photo", "amount", "payment", "activity_log", "story"]) {
  assert.equal(serialized.includes(forbidden), false, `must not include ${forbidden}`);
}

assert.throws(() => buildGoogleManualImportRequest("仕事", []), /1件以上/);
assert.throws(() => buildGoogleManualImportRequest("仕事", [timed, timed]), /重複/);
assert.throws(() => buildGoogleManualImportRequest("仕事", [{ ...timed, startsAt: "invalid" }]), /予定時刻/);
assert.throws(() => buildGoogleManualImportRequest("仕事", Array.from({ length: 2001 }, (_, index) => ({
  ...timed,
  uid: `uid-${index}`,
  occurrenceKey: `occurrence-${index}`
}))), /2000件/);

console.log("MarketNote Google manual import contract: ok");
