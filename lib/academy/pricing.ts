export type AcademyInstructorBillingRecord = {
  profile_id: string;
  registration_status: "registered" | "withdrawn";
};

/**
 * Count unique registered people in one headquarters.
 *
 * The headquarters owner is deliberately not special-cased: when the owner
 * has a registered instructor row, they count like every other instructor.
 * Trusted internal billing code must supply any test profile exclusions.
 */
export function getBillableAcademyInstructorProfileIds(
  instructors: AcademyInstructorBillingRecord[],
  excludedProfileIds: Iterable<string> = []
) {
  const excluded = new Set(excludedProfileIds);
  return Array.from(
    new Set(
      instructors
        .filter((instructor) => instructor.registration_status === "registered")
        .map((instructor) => instructor.profile_id)
        .filter((profileId) => !excluded.has(profileId))
    )
  ).sort();
}

export function getBillableAcademyInstructorCount(
  instructors: AcademyInstructorBillingRecord[],
  excludedProfileIds: Iterable<string> = []
) {
  return getBillableAcademyInstructorProfileIds(instructors, excludedProfileIds).length;
}

/** Monthly prepaid price to apply at the next renewal; never used for mid-term proration. */
export function calculateAcademyCatalogMonthlyPriceYen(instructorCount: number) {
  if (!Number.isSafeInteger(instructorCount) || instructorCount < 0) {
    throw new RangeError("Academy instructor count must be a non-negative safe integer.");
  }
  if (instructorCount <= 20) return 5_000;
  if (instructorCount <= 50) return 10_000;
  if (instructorCount <= 200) return 20_000;
  return 20_000 + (instructorCount - 200) * 100;
}

export type AcademyNextRenewalPriceQuote = {
  instructorCount: number;
  monthlyPriceYen: number;
  appliesAt: "next_renewal";
  prorateCurrentTerm: false;
};

/**
 * Describe the billing contract for a prepaid Academy month.
 * A higher instructor count never changes the already-paid current term.
 */
export function createAcademyNextRenewalPriceQuote(
  instructorCount: number
): AcademyNextRenewalPriceQuote {
  return {
    instructorCount,
    monthlyPriceYen: calculateAcademyCatalogMonthlyPriceYen(instructorCount),
    appliesAt: "next_renewal",
    prorateCurrentTerm: false
  };
}
