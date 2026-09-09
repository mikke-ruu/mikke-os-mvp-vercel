// Read-only preflight. Prints a pinned input manifest; never connects to a DB.
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(process.env.ACADEMY_DB_REPLAY_ROOT??fileURLToPath(new URL('../..',import.meta.url)));
const baselineRoot=process.env.ACADEMY_BASELINE_ROOT??'G:/Musubiプロジェクト/mikke-os-mvp-db-baseline-20260829/supabase/baseline';
const baselineName='20260829000000_mikkeos_schema_baseline.sql';
const sha=b=>createHash('sha256').update(b).digest('hex');
const baseline=await readFile(resolve(baselineRoot,baselineName));
assert.equal(baseline.length,1060178,'baseline byte count');
assert.equal(sha(baseline),'521bf5a61eb8fe572011526faa469a679328f581e3bc291191aef18379c97299','reviewed baseline SHA');
const covered=JSON.parse(await readFile(resolve(baselineRoot,'pre-cutover-migrations-manifest.json'),'utf8'));
assert.equal(covered.migrationCount,151);assert.equal(covered.lastVersion,'20260827140922');
const coveredNames=new Set(covered.migrations.map(x=>x.file));
const files=(await readdir(resolve(root,'supabase/migrations'))).filter(x=>/^\d{14}_.+\.sql$/.test(x)&&!coveredNames.has(x)).sort();
const expectedEarly=[
 '20260820110909_academy_instructor_registration_ledger.sql',
 '20260821043626_academy_access_context_and_creation_gate.sql',
 '20260821100151_academy_application_headquarters_visibility.sql',
 '20260821103043_academy_class_management.sql',
 '20260823223416_academy_learner_portal_context.sql',
 '20260823233441_academy_public_class_scheduling.sql',
 '20260825050958_academy_course_timed_learning_access.sql',
 '20260825062848_academy_secure_video_asset_foundation.sql',
 '20260825075830_academy_application_claim.sql',
 '20260825161200_academy_month_end_billing_snapshots.sql',
 '20260825222427_community_academy_linked_room_entitlements.sql',
 '20260826011738_community_academy_link_acceptance_ui_contract.sql',
 '20260826033657_academy_seven_day_trial_foundation.sql'];
assert.deepEqual(files.filter(x=>x<'20260829000000'),expectedEarly,'baseline-uncovered early migrations');
assert.equal(new Set(files.map(x=>x.slice(0,14))).size,files.length,'duplicate migration versions');
// The same dedicated checkout may be read by the sandbox or Docker-capable user.
// Trust only this explicit checkout for this invocation; never edit global Git policy.
const git=(...args)=>execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const commit=git('rev-parse','HEAD');
const paths=files.map(file=>`supabase/migrations/${file}`);
assert.equal(git('status','--porcelain','--',...paths),'','uncommitted replay inputs');
const blobs=git('rev-parse',...paths.map(path=>`HEAD:${path}`)).split(/\r?\n/);
const actual=git('hash-object','--',...paths).split(/\r?\n/);
assert.deepEqual(actual,blobs,'working bytes differ from commit');
const entries=[];
for(const file of files){
 const path=`supabase/migrations/${file}`;
 const data=await readFile(resolve(root,path));
 entries.push({sequence:entries.length+1,path,bytes:data.length,sha256:sha(data),gitBlob:blobs[entries.length]});
}
console.log(JSON.stringify({mode:'offline_read_only',sourceRoot:root,commit,baseline:{path:resolve(baselineRoot,baselineName),bytes:baseline.length,sha256:sha(baseline)},coveredMigrationCount:151,uncoveredEarlyCount:13,deltaCount:entries.length,entries,databaseConnected:false},null,2));
