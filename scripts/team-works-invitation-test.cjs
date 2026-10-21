const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const file=path.join(__dirname,'../lib/team-works-operations-project.ts');
const mod={exports:{}};
const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
new Function('require','module','exports',code)(()=>({}),mod,mod.exports);
const api=mod.exports;
const projectId='00000000-0000-4000-8000-000000000020';
function db(responses){const calls=[]; return {calls,from(table){const request={table,filters:[]};calls.push(request); const q={then(resolve){return Promise.resolve(responses[table]??{data:[],error:null}).then(resolve)}};for(const method of ['select','eq','in','neq','is','order','limit'])q[method]=(...args)=>{request.filters.push([method,...args]);return q};return q;}}}
(async()=>{
 const pending={id:'legacy',email:'old@example.test',role:'client_user',expires_at:'2026-12-01'};
 const client=db({team_works_member_invites:{data:[pending],error:null},team_works_project_clients:{data:[{client_id:'a'},{client_id:'b'}],error:null},team_works_clients:{data:[{id:'a',email:'old@example.test'},{id:'b',email:'active@example.test'}],error:null}});
 const result=await api.loadOperationsProjectMembers(client,projectId);
 assert.equal(result.pendingInvites.length,2);
 assert.equal(result.pendingInvites.find(i=>i.email==='active@example.test').approvalPending,true);
 assert.equal(result.pendingInvites.filter(i=>i.email==='old@example.test').length,1);
 assert.ok(client.calls.find(c=>c.table==='team_works_project_clients').filters.some(f=>f[1]==='project_id'&&f[2]===projectId));
 console.log('PASS activated client remains visible and duplicate sources are merged');
 const failing=db({team_works_project_clients:{data:null,error:new Error('load failed')}});
 await assert.rejects(api.loadOperationsProjectMembers(failing,projectId),/load failed/);
 console.log('PASS load failure cannot be reported as an empty invitation list');
 const calls=[];
 const rpc={async rpc(name,args){calls.push({name,args});return {error:null}}};
 await api.revokeOperationsProjectInvite(rpc,projectId,result.pendingInvites[1]);
 assert.deepEqual(calls,[{name:'team_works_cancel_project_invitation',args:{target_project_id:projectId,target_email:'active@example.test',target_role:'client_user'}}]);
 await assert.rejects(api.revokeOperationsProjectInvite({rpc:async()=>({error:new Error('denied')})},projectId,pending),/denied/);
 console.log('PASS cancellation uses transactional RPC for both invitation sources and propagates failure');

 const ui=ts.createSourceFile('detail.tsx',fs.readFileSync(path.join(__dirname,'../components/team-works/operations/TeamWorksOperationsProjectDetail.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const handlers=[];
 function visit(n){if(ts.isFunctionDeclaration(n)&&n.name&&(['submitPartner','revokeInvite'].includes(n.name.text)||(n.name.text==='submit'&&n.getText(ui).includes('addOperationsClientToProject')))) handlers.push(n);ts.forEachChild(n,visit)}visit(ui);
 assert.equal(handlers.length,4);
 for(const handler of handlers){
  const events=[];const bindings={supabase:{},data:{project:{id:projectId}},partnerId:'partner',clientId:'client',labels:{workers:'partner'},setBusy:v=>events.push(v?'busy':'idle'),setMessage:()=>{},setPendingOpen:()=>{},reloadMembers:async()=>events.push('refresh'),reload:async()=>events.push('refresh'),addOperationsPartnerToProject:async()=>{throw new Error('partial failure')},addOperationsClientToProject:async()=>{throw new Error('partial failure')},revokeOperationsProjectInvite:async()=>{throw new Error('already revoked')}};
  const js=ts.transpileModule(handler.getText(ui),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
  const run=new Function(...Object.keys(bindings),js+';return '+handler.name.text)(...Object.values(bindings));
  await run({preventDefault(){},email:'test@example.test'});
  assert.deepEqual(events,['busy','refresh','idle']);
 }
 console.log('PASS all four invitation handlers refresh stale rows after a failed mutation');
})().catch(e=>{console.error(e);process.exitCode=1});
