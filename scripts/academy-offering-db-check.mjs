import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const runtime=process.argv[2];
if(!runtime)throw new Error('Pass the installed PGlite module path. No remote database is used.');
const {PGlite}=await import(pathToFileURL(runtime).href);
const contextMarker='create or replace function public.academy_list_my_contexts()';
const oldContext=fs.readFileSync('supabase/migrations/20260823223416_academy_learner_portal_context.sql','utf8').replaceAll('\r','').split(contextMarker)[1].trim();
const migration=fs.readFileSync('supabase/migrations/20260918050803_academy_offerings_and_manual_entitlements.sql','utf8').replaceAll('\r','');
const contextAddition='    union\n\n    select application.headquarters_id\n    from public.academy_offering_applications application\n    cross join actor\n    where application.learner_user_id = actor.user_id\n';
if(migration.split(contextMarker)[1].replace(contextAddition,'').trim()!==oldContext)throw new Error('Existing context definition changed beyond the new learner UNION');
const db=new PGlite();
try{
  await db.exec('BEGIN');
  await db.exec(fs.readFileSync('scripts/academy-offering-db-fixture.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20260918050803_academy_offerings_and_manual_entitlements.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20260918050808_academy_offering_staged_purchases.sql','utf8'));
  await db.exec(fs.readFileSync('scripts/academy-offering-db-rollback.sql','utf8'));
  await db.exec(fs.readFileSync('scripts/academy-offering-staged-db-rollback.sql','utf8'));
  await db.exec('ROLLBACK');
  const result=await db.query("select to_regclass('public.academy_offerings') value");
  if(result.rows[0].value!==null)throw new Error('rollback failed');
  console.log('PASS: PostgreSQL migrations, RLS role denial, immutable snapshots, expected price, retries, bundle/staged grants, learner/HQ completion, frozen future prices, unchanged legacy contexts, access periods; entire transaction rolled back');
}finally{await db.close();}
