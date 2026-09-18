# Academy renewal: production integration gate

Status: implemented and undergoing final release checks. Production publication is not yet verified.

The user approved the local design and full production rollout on 2026-09-18. That approval does not make the localStorage prototype a production persistence implementation.

## Implemented

- Simple course inputs retaining the complete existing CourseInput, with save-before-lesson navigation.
- Course-card preview using existing persisted course fields.
- Instructor portal links to the existing course-scoped manual and Community hub.
- Existing Media-backed instructor editor retained; load failures and overlapping saves handled.
- Separate HQ offerings, independent price, multiple courses, shared LP editor and public application form.
- Server price/course/access snapshots, expected-price comparison, idempotent applications and HQ bank/onsite receipt confirmation.
- Staged purchase with snapshot prices, completion gates and grants only for purchased courses.
- Qualified instructor pages referencing HQ content with editable profiles/additions; immutable instructor attribution across stages.
- HQ/learner/instructor application views and existing content-access integration.
- Course category, ordered images, curriculum and card layout stored without replacing existing feature settings.
- No changes to existing platform billing or Community invitation/consent contracts. New customer Stripe remains unavailable.

## Model gap resolved

The original database lacked a separate offering entity. Three additive migrations now implement offerings, immutable application snapshots, course grants, certified instructor pages and staged purchases. Existing course/application APIs and IDs are preserved. Deletion is restricted; archiving retains history.

Implemented boundaries to verify at release:

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

## Evidence collected before publication

- CourseInput payload/save-failure/double-submit tests passed.
- Actual PublicOffering TSX SSR/submit and purchase helper tests passed, including snapshot pricing, null snapshots, mode changes and retry tokens.
- Context rewrite and scoped application UI tests passed.
- Disposable PostgreSQL all/staged/instructor suites passed, including cross-HQ/wrong-role denial and immutable attribution.
- Actual remote schema BEGIN/ROLLBACK integration passed, including real content-access helpers and completion-based access periods. All fixtures and new schema objects were confirmed absent after rollback.
- Three additive migrations were applied successfully to the production-connected project nttqpprkqbynxyldbnjs: 20260918050803, 20260918050806, 20260918050808. Local filenames match remote history without SQL-content changes.
- Post-apply transaction/rollback contract tests passed. All five new public tables have RLS enabled, no anonymous table SELECT and no authenticated hard DELETE. No real customer applications or payments were created by verification.
- Initial builds found an outer Suspense boundary missing on the study page and an overly broad feature-checkbox key type; both corrected. Final current-tree build, Git and deployment remain separate gates.
- New monthly customer billing remains unavailable. Existing platform subscriptions and old payment links are unchanged.
