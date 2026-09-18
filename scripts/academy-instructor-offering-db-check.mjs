import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const runtime = process.argv[2];
if (!runtime) throw new Error('Pass installed PGlite module path. No remote DB is used.');
const { PGlite } = await import(pathToFileURL(runtime).href);
const db = new PGlite();
try {
  await db.exec('BEGIN');
  for (const path of ['scripts/academy-offering-db-fixture.sql','scripts/academy-instructor-offering-db-fixture.sql','supabase/migrations/20260918050803_academy_offerings_and_manual_entitlements.sql','supabase/migrations/20260918050806_academy_instructor_offering_pages.sql','supabase/migrations/20260918050808_academy_offering_staged_purchases.sql','supabase/migrations/20260918052843_academy_offering_all_completion_snapshot.sql','scripts/academy-instructor-offering-db-rollback.sql']) await db.exec(fs.readFileSync(path,'utf8'));
  await db.exec('ROLLBACK');
  const result = await db.query("select to_regclass('public.academy_instructor_offering_pages') value");
  if (result.rows[0].value !== null) throw new Error('rollback failed');
  console.log('PASS: instructor all-course qualification, HQ/owner RLS, original content, immutable attribution, retry/source denial, deletion protection; rolled back');
} finally { await db.close(); }
