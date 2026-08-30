# mikkeOS schema baseline workspace

This directory prepares the 2026-08-29 database-history cutover. It is not an active migration directory.

## Safety state

- `production-catalog-manifest.json` contains counts and hashes only. It contains no rows, secrets, tokens, or function bodies.
- `pre-cutover-migrations-manifest.json` is generated from local Git files and prepares a future archive. It does not move or delete migrations.
- `20260829000000_mikkeos_schema_baseline.sql` is the authenticated, read-only production schema dump after deterministic removal of production owner statements and restoration of the standard Supabase migration session settings.
- Nothing in this directory authorizes a production migration-history write.

## Commands

```powershell
node scripts/generate-mikkeos-db-baseline-manifest.mjs
node scripts/verify-mikkeos-db-baseline.mjs --scaffold
node scripts/verify-mikkeos-db-baseline.mjs
```

`--scaffold` verifies preparation files without reading the SQL artifact. The default verifier checks the artifact for no data, no secrets, no production ownership, finite timeouts, and the standard post-restore search path/RLS state.

Local PostgreSQL 17 replay evidence on 2026-08-30:

- baseline catalog matched production counts exactly: 178 relations, 2072 columns, 1176 constraints, 660 indexes, 243 functions, 444 policies, and 107 triggers;
- baseline-only replay rolled back with zero application-schema residue;
- frozen Academy/Community package (13 migrations and 4 SQL tests) passed and rolled back with zero residue;
- limited-pilot delta passed after qualifying the paid-access state column reference; the fix remains local and unpublished.
- two simultaneous paid-activation calls produced exactly one success and one post-lock rejection; the transition ledger contained one row, then the disposable local volume was removed without backup.

After approval, the old migration files are moved only after a fresh replay has passed. Until then `supabase/migrations` remains unchanged.
