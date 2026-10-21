const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
function load(file, req) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const mod={exports:{}};
  new Function('require','module','exports',code)(req,mod,mod.exports);
  return mod.exports;
}
let roles, viewAs=false;
let signOutResult={error:null}, signOutCalls=[], stateUpdates=[];
const component = load('components/team-works/TeamWorksRoleSwitcher.tsx', name => {
  if(name==='react/jsx-runtime') return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(name==='react') return {useState:v=>[v,next=>stateUpdates.push(next)],useRef:v=>({current:v})};
  if(name==='@/lib/supabase/client') return {supabase:{auth:{signOut:async options=>{signOutCalls.push(options);return signOutResult}}}};
  if(name==='next/link') return {default:'a'};
  if(name.endsWith('useTeamWorksPortalRoles')) return {useTeamWorksPortalRoles:()=>roles};
  if(name.endsWith('useTeamWorksLabels')) return {useTeamWorksLabels:()=>({workers:'講師'})};
  if(name.endsWith('TeamWorksViewAsContext')) return {useIsViewAs:()=>viewAs};
  throw Error(name);
});
function nodes(tree){if(Array.isArray(tree))return tree.flatMap(nodes);if(!tree||typeof tree!=='object')return [];return [tree,...nodes(tree.props?.children)];}
for(let mask=0;mask<8;mask++){
  roles={hasStaff:!!(mask&1),hasClient:!!(mask&2),hasWorker:!!(mask&4),loading:false};
  const tree=component.TeamWorksRoleSwitcher({current:'client'});
  assert.equal(nodes(tree).filter(n=>n.type==='button').length,1,'logout available with zero or one role');
  const links=nodes(tree).filter(n=>n.type==='a');
  const count=Number(roles.hasStaff)+Number(roles.hasClient)+Number(roles.hasWorker);
  assert.equal(links.length,count<2?0:count);
  assert.equal(links.some(n=>n.props.href==='/apps/team-works'),count>=2&&roles.hasStaff);
  assert.equal(links.some(n=>n.props.href.endsWith('/worker')),count>=2&&roles.hasWorker);
  assert.equal(links.some(n=>n.props.href.endsWith('/client')),count>=2&&roles.hasClient);
  for(const link of links) assert.equal(link.props['aria-current'],link.props.href.endsWith('/client')?'page':undefined);
}
console.log('PASS all 8 role combinations show only available destinations');
roles={hasStaff:true,hasClient:true,hasWorker:true,loading:true};
assert.equal(nodes(component.TeamWorksRoleSwitcher({current:'staff'})).filter(n=>n.type==='a').length,0);
assert.equal(nodes(component.TeamWorksRoleSwitcher({current:'staff'})).filter(n=>n.type==='button').length,1);
console.log('PASS no premature links during loading');
roles.loading=false; viewAs=true;
for(const n of nodes(component.TeamWorksRoleSwitcher({current:'client'})).filter(n=>n.type==='a')){
  assert.equal(n.props['aria-current'],undefined);
  assert.ok(!n.props.href.includes('?'),'never carry impersonation parameters into own portal');
}
console.log('PASS preview switches to own account without preview parameters');

async function hookTest(memberRoles, owned, expected, failure=false){
  global.window={addEventListener(){},removeEventListener(){}};
  global.document={hidden:false,addEventListener(){},removeEventListener(){}};
  let cursor=0; const states=[]; let effect; const filters=[];
  let activated=false;
  const supabase={rpc:async(name)=>{assert.equal(name,'team_works_activate_portal_membership');activated=true;return {error:null}},auth:{getUser:async()=>({data:{user:{id:'self'}},error:null})},from(table){
    assert.ok(activated,'roles must be read after activation completes');
    const q={select(){return q},eq(k,v){filters.push([table,k,v]);return q},limit(){return q},then(resolve){return Promise.resolve({data:table==='team_works_organizations'?(owned?[{id:'org'}]:[]):memberRoles.map(role=>({role})),error:failure?new Error('test failure'):null}).then(resolve)}};return q;
  }};
  const hook=load('components/team-works/useTeamWorksPortalRoles.ts',name=>name==='react'?{useState(v){const i=cursor++;if(!(i in states))states[i]=v;return [states[i],v=>states[i]=v]},useEffect(fn){effect=fn}}:{supabase});
  hook.useTeamWorksPortalRoles(); effect(); await new Promise(r=>setImmediate(r)); cursor=0;
  const result=hook.useTeamWorksPortalRoles();
  assert.deepEqual(result,{...expected,loading:false});
  assert.ok(filters.some(f=>f[1]==='user_id'&&f[2]==='self'));
  assert.ok(filters.some(f=>f[1]==='status'&&f[2]==='active'));
  assert.ok(filters.some(f=>f[1]==='owner_user_id'&&f[2]==='self'));
}
(async()=>{
  for(const current of ['staff','client','worker']) {
    let destination; global.window={location:{replace:v=>destination=v}};
    const button=nodes(component.TeamWorksRoleSwitcher({current})).find(n=>n.type==='button');
    signOutCalls=[]; button.props.onClick(); button.props.onClick();
    await new Promise(r=>setImmediate(r));
    assert.deepEqual(signOutCalls,[{scope:'local'}]);
    assert.equal(new URL(destination,'https://example.test').searchParams.get('next'),current==='staff'?'/apps/team-works':'/apps/team-works/portal/'+current);
    assert.ok(!destination.includes('viewAs'));
  }
  let redirected=false;global.window={location:{replace:()=>redirected=true}};
  signOutResult={error:new Error('network')};stateUpdates=[];
  const failedButton=nodes(component.TeamWorksRoleSwitcher({current:'client'})).find(n=>n.type==='button');
  failedButton.props.onClick();await new Promise(r=>setImmediate(r));
  assert.equal(redirected,false);assert.ok(stateUpdates.some(v=>typeof v==='string'&&v.includes('ログアウトできませんでした')));
  signOutResult={error:null};failedButton.props.onClick();await new Promise(r=>setImmediate(r));assert.equal(redirected,true);
  console.log('PASS local-only logout, three return destinations, duplicate click guard and failure retry');

  await hookTest(['client_user','worker'],false,{hasStaff:false,hasClient:true,hasWorker:true});
  await hookTest(['manager'],false,{hasStaff:true,hasClient:false,hasWorker:false});
  await hookTest([],true,{hasStaff:true,hasClient:false,hasWorker:false});
  await hookTest(['other'],false,{hasStaff:false,hasClient:false,hasWorker:false});
  console.log('PASS active roles, manager, owner-only and unknown roles are scoped to current user');
})().catch(e=>{console.error(e);process.exitCode=1});
