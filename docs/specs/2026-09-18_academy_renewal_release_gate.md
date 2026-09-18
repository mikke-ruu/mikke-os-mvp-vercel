# Academy renewal: production integration gate

Status: incomplete. Do not merge this preparation slice as the completed renewal.

The user approved the local design and full production rollout on 2026-09-18. That approval does not make the localStorage prototype a production persistence implementation.

## Implemented in this preparation slice

- Simple course inputs retaining the complete existing CourseInput, with save-before-lesson navigation.
- Course-card preview using existing persisted course fields.
- Instructor portal links to the existing course-scoped manual and Community hub.
- Existing Media-backed instructor editor retained; load failures and overlapping saves handled.
- No changes to existing platform billing, Community invitations, SQL permissions, or production data.

## Release-blocking model gap

The production database has academy_courses, academy_classes, academy_applications and academy_instructor_pages. A read-only information_schema check found no academy offering table. Existing application RPCs take one course_id and calculate the application amount from academy_courses.price. The approved local model has Offering.courses[], an independent offering price and staged purchases. Mapping it to a course LP alone would display a price or purchased course set that the application backend does not enforce.

Before full rollout, implement and verify:

1. Headquarters-owned offering records and ordered course associations, preserving all existing course IDs and old application URLs.
2. Immutable application offering/price/course snapshots and atomic application creation. Never trust browser-supplied amounts.
3. Course access grants for the purchased set, with staged purchases granting only paid stages. Existing learner content versions must remain valid.
4. Certified instructor offering use and database-enforced deletion/archival protection. Course qualification and Community membership remain separate.
5. Public-safe course-card projection excluding lesson bodies and instructor manuals.
6. Authorized manual storage using existing instructor-page persistence, not prototype localStorage.
7. The approved new recruitment routes, independent price, multi-course set, LP editor and role navigation connected to these records.
8. New customer Stripe controls disabled as preparation-only. Do not disable existing Academy platform billing or old payment links as a side effect.

## Verification before merge

- Existing course fields survive update/readback, including non-visible and unknown presentation metadata.
- Migration dry run and rollback, old-data preservation, cross-headquarters and wrong-role negative checks.
- Displayed offering amount equals server application snapshot; no unintended email or real charge during tests.
- Learner/instructor portals show only their allowed content; old links and existing subscriptions remain usable.
- Desktop/mobile navigation, duplicate content/price display, reload, back, unsaved form and error states.
- Build, type checks, targeted tests, authenticated E2E, GitHub checks and production deployment verification are separate gates.

The course-only preparation does not include category/multi-image storage or an independent curriculum field. Do not describe it as feature parity with the local design.
