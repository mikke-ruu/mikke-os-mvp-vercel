# mikkeOS Academy Release Recovery

Date: 2026-08-15

Worktree: `G:\Musubiプロジェクト\mikke-os-mvp-academy-20260815`

Branch: `codex/academy-release-20260815`

Base: `origin/master` at `0125b31`

## Purpose

Recover the unfinished Academy implementation from the shared legacy checkout without overwriting newer login, mikke ID, Manager, Community, Story, or shared-shell work. Treat implementation, database, deployment, and production verification as separate release gates.

## Source inventory

Compared these Academy-focused roots in the shared checkout and the clean release worktree:

- `app/academy`
- `components/academy`
- `lib/academy`
- Academy-named migrations, scripts, and docs

Result:

| State | Files |
|---|---:|
| Different in both checkouts | 46 |
| Present only in the shared checkout | 75 |
| Present only in current `origin/master` | 1 |

The source-only set contains the unfinished classes, program learning, approvals, credentials, subscriptions, procurement, settings, and related migrations. It must not be copied as one batch because the shared checkout is based on an older master and also contains unrelated changes.

## Supabase evidence

Project inspected read-only: `mikke-os-dev` (`nttqpprkqbynxyldbnjs`).

- The Academy tables for settings, roles, memberships, procurement, programs, assignments, progress, credentials, subscriptions, classes, enrollments, live sessions, tests, and licenses exist.
- All inspected Academy tables have RLS enabled.
- The database migration history contains the Academy G1 through G8 foundations applied on 2026-07-30 and 2026-07-31.
- `academy_classes` currently has `course_id`, `program_id`, `program_version_id`, `instructor_id`, `starts_at`, `format`, and `status`.
- The later schedule fields `ends_at`, `capacity`, `venue_name`, `meeting_url`, `schedule_mode`, and `registration_status` are not present.
- `academy_class_instructor_requests` is not present.
- `academy_courses.feature_settings` is not present.
- The later approval RPC course-id return-shape migration is not present in migration history.

Four shared-checkout migrations are therefore genuinely pending and must be reviewed before application:

1. `20260731174151_academy_class_schedule_details.sql`
2. `20260731175512_academy_class_instructor_requests.sql`
3. `20260801161148_academy_course_feature_settings.sql`
4. `20260802022030_academy_approval_course_ids.sql`

Do not apply the older source migration files under their local timestamps as a batch. Most corresponding schema changes are already present in the database under different applied migration versions. Replaying them would create migration drift or fail on existing objects.

## Recovery slices

### ACR-1: Shared Academy shell

Status: implemented and verified in this worktree.

- Replace the Academy-owned PC sidebar with `MikkeAppShell.navItems`.
- Replace the overlaid mobile navigation with `bottomNavItems`.
- Use the shared owned-app detection hook.
- Keep only routes that exist on current `origin/master`.
- Preserve separate headquarters and instructor portal entrances while using one account.

Verification:

- `git diff --check`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed, 124 static/dynamic route entries generated.
- Existing repository-wide `themeColor` metadata warnings remain and are not introduced by ACR-1.

### ACR-2: Course workspace without new schema

Status: implemented and verified in this worktree.

- Add the course-context workspace around existing course detail, LP, instructor page, and materials routes.
- Do not expose classes, programs, credentials, billing, or procurement routes until their code and schema slice is merged.
- Verify existing course edit and public preview behavior with real headquarters data.

Implemented:

- Added a shared course header with the course name, code, publication status, and public-page action.
- Connected existing course settings, course-page builder, instructor-page builder, and course-filtered materials routes.
- Kept schema-dependent classes, programs, credentials, billing, and procurement out of the navigation.

Verification:

- `git diff --check`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed, 124 static/dynamic route entries generated.

### ACR-3: Classes and instructor requests

Status: database foundation applied and verified in the development project; UI recovery remains pending.

- Replaced the two unapplied legacy class migrations with the reconciled migration `20260815044544_academy_class_scheduling_and_instructor_requests.sql`.
- Added six scheduling columns to `academy_classes` with constraints and indexes.
- Added `academy_class_instructor_requests` with RLS enabled.
- Limited direct table privileges to authenticated `SELECT` and `INSERT`; updates run only through checked RPCs.
- Required `requested_by_user_id = auth.uid()` on insert to protect audit ownership.
- Revalidated headquarters, class, course, and active-instructor scope when an instructor responds.
- Revoked anonymous and default public execution on the helper and public RPCs.

Development database verification:

- Migration application: passed on `mikke-os-dev` (`nttqpprkqbynxyldbnjs`).
- Six scheduling columns: present.
- Request table RLS: enabled.
- Policies: owner insert and owner-or-instructor select, both present.
- Table grants: only authenticated `SELECT` and `INSERT` among API roles.
- New anonymous `SECURITY DEFINER` advisor findings: none.
- The two public RPCs produce expected authenticated `SECURITY DEFINER` warnings. Both require authentication and perform resource-level authorization internally; re-audit after future function changes.

Remaining ACR-3 work:

- Recover the classes and instructor-request UI against the new schema.
- Test headquarters owner, requested instructor, unrelated authenticated user, and anonymous access separately.

### ACR-4: Program learning and approvals

- Recover program builder, assignments, learner flow, submissions, tests, live sessions, and approvals.
- Reconcile the pending approval RPC return-shape migration.
- Test headquarters, instructor, assigned learner, unrelated learner, and anonymous access separately.

### ACR-5: Credentials and subscription entitlement

- Recover credentials, renewals, billing configuration, subscription controls, and member-visible status.
- Keep external-payment confirmation separate from automated checkout/webhook claims.
- Resolve the existing procurement status RPC security-advisor concern before release.

### ACR-6: Release

- Real-account UAT for headquarters, instructor, learner, and unregistered applicant.
- Focused lint, full build, commit, PR, Vercel success, production route verification, and homepage redirect.
- Keep paid release blocked until payment lifecycle, legal text, data lifecycle, and operating procedures pass separately.

## Current release boundary

ACR-1 and ACR-2 are implementation-complete locally. The ACR-3 database foundation is applied only to the development Supabase project. Nothing in this branch is pushed, deployed, or production-verified.

The project-wide security advisor reports 17 pre-existing Academy-related findings, including five functions callable by `anon` and multiple authenticated `SECURITY DEFINER` functions. These findings remain a separate security gate. See the Supabase remediation references for [anonymous SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [authenticated SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
