# mikkeOS database baseline / cutover plan

Date: 2026-08-29  
Owner: mikkeOS control room  
Base: `origin/master@1cc0857cd32779fcadcf23b80f0ea415ff584a65`  
Branch: `codex/mikkeos-db-baseline-20260829`

## Decision

Create one current, schema-only baseline from the production database and make it the first migration replayed by a fresh database. Do not repair the historical chain by adding compatibility patches to every existing migration.

The production schema is read-only source material. The baseline must not contain customer rows, authentication users, Storage objects, secrets, tokens, passwords, Vault contents, or connection strings.

## Confirmed cause

- `supabase/migrations` starts at `20260714070637`, but that first file already references pre-existing objects such as `public.profiles`.
- Production migration history also starts at `20260714070637`; therefore the missing foundation is not recoverable from the recorded history.
- No earlier foundation migration exists in reachable Git objects.
- A new Supabase Preview branch replays Git migrations. It does not clone the production schema. The empty Preview result is therefore consistent with the missing foundation.
- Current `origin/master` has 151 migration files, not the earlier estimate of 104. Production has 149 history rows, but this is not a simple two-file difference: 34 local names are absent from production history, 32 production names are absent from Git, 69 matching names have different versions, and only 48 name/version pairs match exactly.

## Baseline scope

The schema dump must include the application-owned schemas:

- `public`
- `private`
- `community_private`

The dump must include relations, columns/defaults, sequences, constraints, indexes, views, functions, triggers, RLS state, policies, and grants for those schemas.

The dump must exclude:

- all table rows and sequence values;
- `auth.users`, sessions, identities, and all other Auth data;
- `storage.objects` and uploaded file metadata;
- Vault/secrets, passwords, API keys, connection strings, and local environment files;
- ownership or role statements that bind the replay to a production-only role;
- Supabase-managed schemas unless an application-owned grant or policy requires a small, reviewed follow-up migration.

Storage bucket definitions and Storage policies are not silently inferred from a schema-only dump. They require a separate, allowlisted configuration migration derived from source migrations, never from user object rows.

## Files and states

- `supabase/baseline/production-catalog-manifest.json`: read-only production catalog fingerprint taken before the dump.
- `supabase/baseline/pre-cutover-migrations-manifest.json`: generated list and SHA-256 for every current migration file. This prepares an archive; it does not move files.
- `supabase/baseline/20260829000000_mikkeos_schema_baseline.sql`: expected dump output. It must not be committed until verified.
- `supabase/baseline/history-cutover-plan.md`: production history reconciliation design. No history write is authorized now.
- `scripts/generate-mikkeos-db-baseline-manifest.mjs`: deterministic local manifest generator.
- `scripts/verify-mikkeos-db-baseline.mjs`: fail-closed baseline validator.

## Cutover sequence

1. Authenticate the Supabase CLI through the official browser flow. Never paste or record an access token in project files or chat.
2. Run `supabase db dump --linked --schema public,private,community_private --file supabase/baseline/20260829000000_mikkeos_schema_baseline.sql` against production. This is read-only.
3. Run the baseline verifier. Review every flagged statement and confirm the production catalog fingerprint has not changed during capture.
4. Create a separate reviewed Storage configuration migration from existing source-controlled bucket/policy intent. Never export `storage.objects`.
5. Only after the baseline replays on an empty local/Preview database, move the pre-cutover migration files to `supabase/migrations_archive/pre_baseline/2026-08-29/` and put the approved baseline at the start of active `supabase/migrations`.
6. Replay the baseline plus post-cutover migrations on an empty database. Run Academy's 13 migrations and 4 SQL negative-test suites and Community's canonical migrations/tests without modifying their owned files.
7. Compare replay catalog fingerprints and security checks with production. Exact equality is required for the covered schemas, except for a documented allowlist of Supabase-managed differences.
8. Request a separate production-write approval before changing `supabase_migrations.schema_migrations`. Do not use `supabase db push` for the cutover.
9. Request separate approvals for push, PR, merge, deployment, and publication.

## Current gate

The authenticated schema-only artifact is now generated and locally replayed. Its SHA-256 is `521BF5A61EB8FE572011526FAA469A679328F581E3BC291191AEF18379C97299` (1,060,178 bytes). Production owner statements were removed mechanically, no table rows or secrets are present, and the verifier passes.

PostgreSQL 17.6 local replay matched the production catalog counts exactly: 178 relations, 2072 columns, 1176 constraints, 660 indexes, 243 functions, 444 policies, and 107 triggers. Baseline-only replay, the frozen Academy/Community 13-migration + 4-test package, and the Academy limited-pilot delta all rolled back with zero application-schema/auth-fixture residue.

Replay exposed one real P0 in the unpublished limited-pilot delta: an ambiguous `headquarters_id` reference in `academy_activate_paid_access`. It was fixed locally by qualifying the access-state table alias and the SQL negative test then passed through paid activation. No production, Preview, push, PR, deployment, or publication change has occurred.

Remaining cutover gates are deterministic archive/cutover review, catalog hash evidence packaging, isolated JWT/service-role and two-connection contention tests, then separate approvals for GitHub and production history/application. The baseline is no longer blocked by CLI authorization or Docker/WSL.

No production writes, Preview branch, database transaction, push, PR, deployment, publication, or Docker/WSL configuration change has been made in this work.
