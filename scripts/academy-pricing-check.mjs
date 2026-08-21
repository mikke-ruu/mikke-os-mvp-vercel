import assert from "node:assert/strict";
import {
  calculateAcademyCatalogMonthlyPriceYen,
  createAcademyNextRenewalPriceQuote,
  getBillableAcademyInstructorCount,
  getBillableAcademyInstructorProfileIds
} from "../lib/academy/pricing.ts";

const instructors = [
  { profile_id: "owner", registration_status: "registered" },
  { profile_id: "owner", registration_status: "registered" },
  { profile_id: "dormant-instructor", registration_status: "registered" },
  { profile_id: "withdrawn-instructor", registration_status: "withdrawn" },
  { profile_id: "test-instructor", registration_status: "registered" }
];

assert.deepEqual(
  getBillableAcademyInstructorProfileIds(instructors, ["test-instructor"]),
  ["dormant-instructor", "owner"],
  "Registered owner must count, duplicate courses must count once, and trusted test exclusions must be honored"
);
assert.equal(getBillableAcademyInstructorCount(instructors, ["test-instructor"]), 2);

const priceCases = [
  [0, 5_000],
  [20, 5_000],
  [21, 10_000],
  [50, 10_000],
  [51, 20_000],
  [200, 20_000],
  [201, 20_100],
  [300, 30_000],
  [500, 50_000],
  [800, 80_000]
];

for (const [count, expected] of priceCases) {
  assert.equal(calculateAcademyCatalogMonthlyPriceYen(count), expected, `Unexpected price for ${count} instructors`);
}

assert.throws(() => calculateAcademyCatalogMonthlyPriceYen(-1), RangeError);
assert.throws(() => calculateAcademyCatalogMonthlyPriceYen(1.5), RangeError);

assert.deepEqual(createAcademyNextRenewalPriceQuote(21), {
  instructorCount: 21,
  monthlyPriceYen: 10_000,
  appliesAt: "next_renewal",
  prorateCurrentTerm: false
});
assert.deepEqual(createAcademyNextRenewalPriceQuote(51), {
  instructorCount: 51,
  monthlyPriceYen: 20_000,
  appliesAt: "next_renewal",
  prorateCurrentTerm: false
});

console.log("Academy pricing and instructor-count contracts: OK");
