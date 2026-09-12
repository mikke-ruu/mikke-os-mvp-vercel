# Migration history cutover plan

Status: proposal only; no production write is authorized.

## Current facts

- Production history has 149 rows, from `20260714070637` through `20260827140922`.
- The local active folder has 151 files while production history has 149 rows. This is structural drift: 34 local names are absent from production history, 32 production names are absent from Git, 69 shared names have different versions, and only 48 name/version pairs match exactly.
- The first recorded migration depends on objects created before recorded history.

## Target model

1. Archive every migration that is already represented by the approved baseline.
2. Keep the archive immutable and checksum-addressed.
3. Place one approved baseline migration at the start of the active chain.
4. Keep only post-cutover migrations after it.
5. On fresh databases, apply the baseline normally and record only the new chain.
6. On production, do not execute the baseline. After a separate write approval, reconcile history in one short transaction so the CLI sees production at the same logical cutover point.

## Production reconciliation gate

Before any write:

- re-read the production catalog and migration-history fingerprints;
- prove the baseline SHA-256 matches the reviewed Git artifact;
- prove production already has the baseline objects and no baseline SQL will run there;
- prepare exact expected rows before and after reconciliation;
- set short `lock_timeout` and `statement_timeout`;
- run a rollback-only rehearsal that changes history only inside the transaction;
- verify rollback restores the original 149-row history and all schema fingerprints remain unchanged.

The final production transaction, if later approved, may modify only `supabase_migrations.schema_migrations`. It must not alter application schemas or data. The exact SQL is deliberately omitted until the baseline SHA and post-cutover version are final, preventing accidental early execution.

## Fresh replay acceptance

- empty database starts with zero application relations and zero migration history;
- baseline applies once;
- Academy's supplied 13 migrations and 4 SQL negative-test suites pass unchanged;
- Community's canonical migrations and SQL tests pass unchanged;
- RLS, grants, SECURITY DEFINER `search_path`, anonymous Auth rejection, lock ordering, and zero-residue rollback tests pass;
- final covered-schema fingerprint matches production or an explicitly reviewed difference list;
- a second replay reports no pending migration and no duplicate-object failure.
