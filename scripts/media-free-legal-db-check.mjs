import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

assert.ok(process.argv.includes("--run"), "Explicit --run is required");
const docker="C:/Users/user/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe";
const container="mikke-media-free-legal-replay-20260909";
const image="postgres:17.6";
const baselinePath="G:/Musubiプロジェクト/mikke-os-mvp-db-baseline-20260829/supabase/baseline/20260829000000_mikkeos_schema_baseline.sql";
const bootstrapPath="G:/Musubiプロジェクト/mikke-os-mvp-hq-access-management-20260831/supabase/tests/hq_local_auth_bootstrap.sql";
const files=[
  "../supabase/migrations/20260902054001_media_free_foundation.sql",
  "../supabase/migrations/20260909092651_media_free_private_publication_gate.sql",
  "../supabase/migrations/20260909170000_media_free_legal_activation.sql",
  "../supabase/tests/media_free_legal_activation.sql"
];
function command(args,input,allowFailure=false){
  const result=spawnSync(docker,args,{input,encoding:"utf8",timeout:300000,maxBuffer:32*1024*1024});
  if(!allowFailure&&result.status!==0)throw Error(result.stderr||result.stdout||result.error?.message||`docker exit ${result.status}`);
  return result;
}
function psql(sql){return command(["exec","-i",container,"/usr/bin/psql","-X","-q","-A","-t","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],sql).stdout;}
function snapshot(){return psql(`select json_build_object(
  'mediaRelations',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and c.relname like 'media_%'),
  'mediaFunctions',(select count(*) from pg_proc where proname like 'media_%'),
  'users',(select count(*) from auth.users),
  'history',(select count(*) from supabase_migrations.schema_migrations));`).trim();}

const baseline=readFileSync(baselinePath,"utf8");
assert.equal(createHash("sha256").update(baseline).digest("hex").toUpperCase(),"521BF5A61EB8FE572011526FAA469A679328F581E3BC291191AEF18379C97299");
const bootstrap=readFileSync(bootstrapPath,"utf8");
const sqlFiles=files.map(file=>readFileSync(new URL(file,import.meta.url),"utf8"));
// The schema-only production baseline predates Supabase Storage catalog tables.
// Add the minimum compatible catalog in this disposable harness only.
const storageHarness=`
create table if not exists storage.buckets(
  id text primary key,name text not null,public boolean not null default false,
  file_size_limit bigint,allowed_mime_types text[]
);
create table if not exists storage.objects(
  id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),
  name text not null,owner uuid,metadata jsonb,created_at timestamptz default now(),updated_at timestamptz default now()
);
alter table storage.objects enable row level security;
`;
let created=false;
try{
  assert.notEqual(command(["inspect",container],undefined,true).status,0,"Refusing to reuse a container");
  command(["run","--detach","--name",container,"--network","none","--tmpfs","/var/lib/postgresql/data:rw","-e","POSTGRES_HOST_AUTH_METHOD=trust",image]);created=true;
  let ready=false;for(let i=0;i<40;i++){if(command(["exec",container,"pg_isready","-U","postgres"],undefined,true).status===0){ready=true;break;}Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,500);}assert.ok(ready);
  const inspected=JSON.parse(command(["inspect",container]).stdout)[0];
  assert.equal(inspected.HostConfig.NetworkMode,"none");assert.equal(Object.keys(inspected.HostConfig.PortBindings??{}).length,0);assert.equal(inspected.HostConfig.Tmpfs["/var/lib/postgresql/data"],"rw");
  psql(bootstrap);const before=snapshot();
  const output=psql(["begin;",baseline,storageHarness,...sqlFiles].join("\n"));
  assert.ok(output.split(/\r?\n/).includes("media_free_legal_activation_test_ok"));
  assert.equal(snapshot(),before,"Rollback residue detected");
  console.log(JSON.stringify({scope:"isolated-postgres-17.6",sentinel:"media_free_legal_activation_test_ok",rollback:true,residue:0,cleanup:"container and volume removed"}));
}finally{if(created){const removed=command(["rm","--force","--volumes",container],undefined,true);if(removed.status!==0)throw Error(removed.stderr||removed.stdout);}}
