/** Synthetic initial fixtures only; no Auth sign-in, paid provider or published-date rewrites. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const project='academy-release-auth-20260909',container=`supabase_db_${project}`;
assert.equal(process.env.ACADEMY_CONCURRENCY_RUN,'local-fixtures-only');
const docker=process.platform==='win32'?'C:/Users/user/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe':'docker';
const run=(args,input)=>execFileSync(docker,args,{input,encoding:'utf8',windowsHide:true,timeout:30000,stdio:['pipe','pipe','pipe']});
assert.equal(JSON.parse(run(['inspect','--format','{{json .Config.Labels}}',container]))['com.supabase.cli.project'],project);
const query=sql=>run(['exec','-i',container,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],sql).trim();
const batch=Number(process.env.ACADEMY_CONCURRENCY_BATCH??'1');
assert.ok(Number.isInteger(batch)&&batch>=1&&batch<=20,'Explicit local batch 1–20 only; old evidence is retained');
const id=n=>`f9090000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=id(batch),hqs=[id(99+batch*2),id(100+batch*2)],quotes=[id(199+batch*2),id(200+batch*2)];
const policy=`local-concurrency-f9090000-batch-${batch}`;
assert.equal(query(`select not exists(select 1 from auth.users where id='${owner}') and not exists(select 1 from public.academy_headquarters where id in ('${hqs[0]}','${hqs[1]}')) and not exists(select 1 from academy_publication_private.quotes where id in ('${quotes[0]}','${quotes[1]}')) and not exists(select 1 from academy_publication_private.policies where version='${policy}');`),'t','Target fixture IDs must be unused; never overwrite a prior run');
query(`begin;
 insert into auth.users(id,email,is_anonymous,raw_user_meta_data,raw_app_meta_data) values('${owner}','concurrency-${batch}@example.invalid',false,'{"full_name":"LOCAL CONCURRENCY FIXTURE"}','{}');
 insert into public.academy_headquarters(id,owner_user_id,name,handle,tagline,is_active) values
 ('${hqs[0]}','${owner}','LOCAL concurrency commit ${batch}','local-concurrency-c-${batch}','SYNTHETIC LOCAL CONCURRENCY FIXTURE',false),
 ('${hqs[1]}','${owner}','LOCAL concurrency rollback ${batch}','local-concurrency-r-${batch}','SYNTHETIC LOCAL CONCURRENCY FIXTURE',false);
 insert into academy_publication_private.policies(version,approval_id,terms_revision,quote_ttl_seconds,enabled,initial_price,cancellation,eligibility,dispatch_enabled,pricing_revision,consent_revision)
 values('${policy}','synthetic-no-approval','synthetic-terms',1800,false,'fixed_at_publication','inclusive_deadline','no_previous_trial_or_contract',false,'synthetic-price','synthetic-consent');
 insert into academy_publication_private.quote_display_catalog(policy_version,pricing_revision,plan_key,plan_name,discount_description,consent_revision) values('${policy}','synthetic-price','small','LOCAL test plan','SYNTHETIC no real price agreement','synthetic-consent');
 ${hqs.map((hq,i)=>`insert into academy_publication_private.quotes(id,headquarters_id,owner_user_id,policy_version,terms_revision,amount_yen,instructor_count,issued_at,expires_at,pricing_revision) values('${quotes[i]}','${hq}','${owner}','${policy}','synthetic-terms',5000,1,clock_timestamp(),clock_timestamp()+interval '30 minutes','synthetic-price');
 insert into academy_publication_private.enrollments(headquarters_id,owner_user_id,policy_version,approval_id,terms_revision,quote_id,amount_yen,instructor_count,consent_at,payment_preparation_id,phase)
 values('${hq}','${owner}','${policy}','synthetic-no-approval','synthetic-terms','${quotes[i]}',5000,1,clock_timestamp(),'synthetic-no-provider-proof','prepared');`).join('\n')}
 commit;`);
console.log(JSON.stringify({fixture:'synthetic-concurrency',batch,owner,headquarters:hqs,policyEnabled:false,dispatchEnabled:false,realAuth:false,provider:false}));
process.env.ACADEMY_CONCURRENCY_OWNER_ID=owner;
process.env.ACADEMY_CONCURRENCY_COMMIT_HQ=hqs[0];
process.env.ACADEMY_CONCURRENCY_ROLLBACK_HQ=hqs[1];
process.env.ACADEMY_CONCURRENCY_FIXTURE_PREFIX='f9090000-';
await import('./academy_first_publication_concurrency.mjs');
