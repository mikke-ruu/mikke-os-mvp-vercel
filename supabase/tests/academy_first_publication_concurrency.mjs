/** Real PostgreSQL backends, local disposable fixtures only. Not a JWT/Auth E2E.
 * Required env: ACADEMY_CONCURRENCY_RUN=local-fixtures-only,
 * ACADEMY_CONCURRENCY_OWNER_ID, ACADEMY_CONCURRENCY_COMMIT_HQ,
 * ACADEMY_CONCURRENCY_ROLLBACK_HQ, ACADEMY_CONCURRENCY_FIXTURE_PREFIX (8 hex digits + '-').
 * Container is deliberately pinned. Main must first seed dedicated prepared enrollments.
 * Each fixture's first publication is initialized once, 168h before a five-second deadline.
 * Does not delete immutable evidence, change schemas, call providers or enable dispatch.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const container = 'supabase_db_academy-release-auth-20260909';
const docker = process.platform === 'win32' ? 'C:/Users/user/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe' : 'docker';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if(process.env.ACADEMY_CONCURRENCY_RUN!=='local-fixtures-only')throw Error('Set explicit local-fixtures-only execution guard; no database was contacted.');
const owner=process.env.ACADEMY_CONCURRENCY_OWNER_ID;
const commitHq=process.env.ACADEMY_CONCURRENCY_COMMIT_HQ;
const rollbackHq=process.env.ACADEMY_CONCURRENCY_ROLLBACK_HQ;
const fixturePrefix=process.env.ACADEMY_CONCURRENCY_FIXTURE_PREFIX;
assert.ok(/^[0-9a-f]{8}-$/i.test(fixturePrefix??''),'Explicit dedicated fixture UUID prefix required');
for(const value of [owner,commitHq,rollbackHq])assert.ok(UUID.test(value??''),'Dedicated fixture UUIDs are required');
for(const value of [owner,commitHq,rollbackHq])assert.ok(value.toLowerCase().startsWith(fixturePrefix.toLowerCase()),'Owner/HQ must belong to the explicitly named disposable fixture prefix');
assert.notEqual(commitHq,rollbackHq,'Commit and rollback cases need separate untouched fixtures');
const sessions=[];
class Session {
  constructor(label) {
    this.label=label;this.buffer='';this.errors='';this.pending=null;this.closed=false;
    this.child=spawn(docker,['exec','-i',container,'psql','-X','-q','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
    sessions.push(this);
    this.child.stdout.on('data',data=>{this.buffer+=data.toString();this.drain();});
    this.child.stderr.on('data',data=>{this.errors+=data.toString();});
    this.child.on('error',error=>this.fail(error));
    this.child.on('close',code=>{this.closed=true;this.fail(Error(`${label}: psql exited ${code}: ${this.errors}`));});
  }
  fail(error){if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(error);this.pending=null;}}
  drain(){if(!this.pending)return;const end=this.buffer.indexOf(`${this.pending.marker}\n`);if(end<0)return;
    const output=this.buffer.slice(0,end).trim();this.buffer=this.buffer.slice(end+this.pending.marker.length+1);
    const {resolve,timer}=this.pending;clearTimeout(timer);this.pending=null;resolve(output);
  }
  query(sql){assert.ok(!this.pending&&!this.closed,`${this.label}: concurrent/closed query`);
    return new Promise((resolve,reject)=>{const marker=`done_${randomUUID().replaceAll('-','')}`;
      const timer=setTimeout(()=>{this.fail(Error(`${this.label}: bounded query timeout`));this.child.kill();},15000);
      this.pending={resolve,reject,marker,timer};this.child.stdin.write(`${sql}\n\\echo ${marker}\n`);
    });
  }
  async json(sql){return JSON.parse(await this.query(sql));}
  async close(){if(!this.closed){this.child.stdin.end('ROLLBACK;\n\\q\n');await new Promise(resolve=>{const timer=setTimeout(()=>{this.child.kill();resolve();},2000);this.child.once('close',()=>{clearTimeout(timer);resolve();});});}}
}
const sqlId=id=>`'${id}'::uuid`;
const append=(hq,key)=>`select public.academy_first_publication_cancel_append(${sqlId(hq)},${sqlId(key)});`;
const ack=(hq,key)=>`select public.academy_first_publication_cancel_acknowledge(${sqlId(hq)},${sqlId(key)});`;
const report={kind:'local_real_postgres_concurrency',authentication:'SET ROLE plus fixture JWT claim; not real sign-in or PostgREST',container,cases:[]};
try {
  const a=new Session('append-A'),b=new Session('barrier-B');
  for(const s of [a,b])await s.query("set statement_timeout='10s'; set lock_timeout='3s'; set idle_in_transaction_session_timeout='60s'; set default_transaction_isolation='read committed';");
  const [aInfo,bInfo]=await Promise.all([a.json("select jsonb_build_object('pid',pg_backend_pid(),'isolation',current_setting('transaction_isolation'));"),b.json("select jsonb_build_object('pid',pg_backend_pid(),'version',current_setting('server_version'),'database',current_database());")]);
  assert.notEqual(aInfo.pid,bInfo.pid);assert.equal(aInfo.isolation,'read committed');assert.equal(bInfo.database,'postgres');report.backends={a:aInfo,b:bInfo};
  for(const [name,hq] of [['commit',commitHq],['rollback',rollbackHq]]) {
    await b.query('reset role;');
    const before=await b.json(`select jsonb_build_object('owner',h.owner_user_id,'phase',e.phase,'first',e.first_published_at,'deadline',e.trial_ends_at,'cancelled',e.cancellation_accepted_at,'receipts',(select count(*) from academy_publication_private.receipt_inbox where headquarters_id=h.id),'sequence',coalesce((select last_sequence from academy_publication_private.receipt_scopes where headquarters_id=h.id),0)) from public.academy_headquarters h join academy_publication_private.enrollments e on e.headquarters_id=h.id where h.id=${sqlId(hq)};`);
    assert.equal(before.owner,owner);assert.equal(before.phase,'prepared');assert.equal(before.first,null);assert.equal(before.deadline,null);assert.equal(before.cancelled,null);assert.equal(before.receipts,0);assert.equal(before.sequence,0);
    // Explicit synthetic fixture transition only; never rewrite an established publication.
    const fixture=await b.json(`with instant as (select clock_timestamp()+interval '5 seconds' as deadline), initialized as (update academy_publication_private.enrollments e set first_published_at=instant.deadline-interval '168 hours',trial_ends_at=instant.deadline,phase='trialing' from instant where e.headquarters_id=${sqlId(hq)} and e.owner_user_id=${sqlId(owner)} and e.phase='prepared' and e.first_published_at is null and e.trial_ends_at is null and e.cancellation_accepted_at is null returning e.first_published_at,e.trial_ends_at) select jsonb_build_object('first',first_published_at,'deadline',trial_ends_at,'now',clock_timestamp()) from initialized;`);
    assert.equal(Date.parse(fixture.deadline)-Date.parse(fixture.first),168*3600000);
    assert.ok(Date.parse(fixture.deadline)>Date.parse(fixture.now),'Fixture deadline must still be future');
    const key=randomUUID();
    await a.query(`set role authenticated; set request.jwt.claim.sub='${owner}'; BEGIN ISOLATION LEVEL READ COMMITTED;`);
    assert.equal((await a.json(append(hq,key))).status,'awaiting_durable_acknowledgment');
    // Same backend/transaction cannot acknowledge its own uncommitted append.
    await a.query(`do $negative$ begin begin perform public.academy_first_publication_cancel_acknowledge(${sqlId(hq)},${sqlId(key)}); raise exception 'test_expected_same_tx_ack_rejection'; exception when others then if sqlerrm <> 'separate_acknowledgment_transaction_required' then raise; end if; end; end $negative$;`);
    await b.query('set role service_role;');
    // Use the DB clock, not the client clock, and bound every wait.
    const waitStart=Date.now();let after;
    do {after=await b.json(`select jsonb_build_object('after',clock_timestamp()>${JSON.stringify(fixture.deadline).replaceAll('"',"'")}::timestamptz);`);
      if(!after.after)await new Promise(resolve=>setTimeout(resolve,100));
      assert.ok(Date.now()-waitStart<45000,'deadline wait timeout');
    }while(!after.after);
    const barrier=await b.json(`select public.academy_first_publication_receipt_barrier(${sqlId(hq)});`);
    assert.equal(barrier.status,'awaiting_commit');assert.ok(UUID.test(barrier.barrier_id));
    const pending=await b.json(`select public.academy_first_publication_receipt_prove(${sqlId(barrier.barrier_id)});`);
    assert.deepEqual(pending,{verified:false,reason:'pre_barrier_transactions_pending'});
    await a.query(name==='commit'?'COMMIT;':'ROLLBACK;');
    const proven=await b.json(`select public.academy_first_publication_receipt_prove(${sqlId(barrier.barrier_id)});`);
    assert.equal(proven.verified,true);assert.equal(proven.cancellation_exists,name==='commit');assert.equal(proven.receipt_count,name==='commit'?1:0);
    let accepted=null;
    if(name==='commit') {
      accepted=await a.json(ack(hq,key));assert.equal(accepted.status,'accepted');assert.equal(accepted.sequence,1);
      assert.ok(Date.parse(accepted.request_received_at)<=Date.parse(fixture.deadline));
      assert.equal((await a.json(append(hq,key))).status,'awaiting_durable_acknowledgment');
      const replay=await a.json(ack(hq,key));assert.deepEqual(replay,accepted,'Same-key replay must preserve receipt ID, sequence and both timestamps');
    }
    await b.query('reset role;');
    const counts=await b.json(`select jsonb_build_object('sequence',coalesce((select last_sequence from academy_publication_private.receipt_scopes where headquarters_id=${sqlId(hq)}),0),'count',(select count(*) from academy_publication_private.receipt_inbox where headquarters_id=${sqlId(hq)}),'proofCount',(select receipt_count from academy_publication_private.receipt_proofs where headquarters_id=${sqlId(hq)}));`);
    assert.equal(counts.sequence,counts.count);assert.equal(counts.count,counts.proofCount);assert.equal(counts.count,name==='commit'?1:0);
    report.cases.push({name,headquartersId:hq,sameTransactionAck:'rejected',pending,proven,counts,accepted});
    console.log(JSON.stringify({case:name,result:'PASS',counts}));
  }
  console.log(JSON.stringify({...report,result:'PASS',residue:'Committed fixture receipt/barriers/proofs retained for audit; no destructive cleanup or production activation.'},null,2));
} finally { await Promise.all(sessions.map(session=>session.close())); }
