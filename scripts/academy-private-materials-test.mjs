import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const uid=n=>String(n).padStart(32,'0').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
const pdf=new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
let state;
function reset(){state={authenticated:true,anonymous:false,ready:true,visible:true,writable:true,uploadError:false,expireDuringDownload:false,assets:[],calls:[]};}
function client(_url,key,options){
 const admin=key==='secret';
 state.calls.push({kind:'client',admin,authorization:options.global?.headers?.Authorization});
 return {
  auth:{getUser:async token=>({data:{user:state.authenticated?{id:uid(1),is_anonymous:state.anonymous}:null},error:token==='valid'?null:{message:'bad'}})},
  rpc:async(name,args)=>{state.calls.push({kind:'rpc',name,admin,args});return {data:name==='academy_private_materials_ready'?(state.ready?'private-pdf-v1':null):state.writable,error:null};},
  from(table){
   let op='select',payload,filters=[];
   const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},limit(){return q;},insert(p){op='insert';payload=p;return q;},update(p){op='update';payload=p;return q;},
   async single(){return result(true);},async maybeSingle(){return result(true);},then(resolve,reject){return Promise.resolve(result(false)).then(resolve,reject);}};
   function result(single){
    state.calls.push({kind:'db',table,op,admin,payload,filters});
    if(op==='insert'){
     if(table==='academy_materials')return {data:{id:uid(103),...payload},error:null};
     const asset={created_at:'2026-09-13T00:00:00Z',learner_page_id:null,instructor_material_id:null,...payload};state.assets.push(asset);return {data:asset,error:null};
    }
    if(op==='update'){const a=state.assets.find(a=>filters.every(([k,v])=>a[k]===v));if(a)Object.assign(a,payload);return {data:a?{id:a.id}:null,error:null};}
    if(table==='academy_courses'||table==='academy_materials'||table==='academy_learner_pages')return {data:{id:uid(102),headquarters_id:uid(100),course_id:uid(101)},error:null};
    const rows=state.visible?state.assets.filter(a=>filters.every(([k,v])=>a[k]===v)):[];
    return {data:single?(rows[0]??null):rows,error:null};
   }
   return q;
  },
  storage:{from(bucket){return {
   async upload(path,bytes,options){state.calls.push({kind:'upload',admin,bucket,path,options});state.bytes=bytes;return {error:state.uploadError?{message:'fail'}:null};},
   async download(path){state.calls.push({kind:'download',admin,bucket,path});if(state.expireDuringDownload)state.visible=false;return {data:new Blob([state.bytes??pdf]),error:null};}
  };}}
 };
}
const env={ACADEMY_PRIVATE_MATERIALS_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://test.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'anon',SUPABASE_SECRET_KEY:'secret'};
const modules=new Map();
function load(path){
 if(modules.has(path))return modules.get(path);
 const exports={};const source=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const context={exports,require:name=>name==='server-only'?{}:name==='@supabase/supabase-js'?{createClient:client}:name==='./private-material-contract'?load('lib/academy/private-material-contract.ts'):require(name),process:{env},Request,Response,Headers,Blob,Uint8Array,TextDecoder,TextEncoder,AbortSignal,URL,setTimeout,clearTimeout};
 vm.runInNewContext(source,context,{filename:path});modules.set(path,exports);return exports;
}
const contract=load('lib/academy/private-material-contract.ts');
const api=load('lib/academy/private-material-server.ts');
const base='http://localhost:3198/api/academy/private-materials';
const query=`?audience=learner&parentId=${uid(102)}`;
function request({method='POST',body=pdf,token='valid',origin='http://localhost:3198',contentType='application/pdf',name='教材.pdf',suffix=query}={}){
 return new Request(base+suffix,{method,headers:{Authorization:`Bearer ${token}`,Origin:origin,'Content-Type':contentType,'X-Academy-Filename':encodeURIComponent(name)},...(method==='GET'?{}:{body})});
}
const error=async(response,status)=>{assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(typeof(await response.json()).error,'string');};
reset();
assert(contract.isPdfBytes(pdf));assert(!contract.isPdfBytes(new TextEncoder().encode('<html>bad</html>')));
assert.equal(contract.pdfFilename('%E0%A4%A'),null);assert.equal(contract.pdfFilename('..%2Fa.pdf'),null);assert.equal(contract.pdfFilename('x%0D%0A.pdf'),null);
assert.equal(contract.privateMaterialParent(new URL(base+'?audience=other&parentId='+uid(1))),null);
env.ACADEMY_PRIVATE_MATERIALS_ENABLED='false';await error(await api.privateMaterials(request()),503);assert.equal(state.calls.length,0);env.ACADEMY_PRIVATE_MATERIALS_ENABLED='true';
reset();state.authenticated=false;await error(await api.privateMaterials(request()),401);assert(!state.calls.some(c=>c.admin));
reset();state.anonymous=true;await error(await api.privateMaterials(request()),401);
reset();state.ready=false;await error(await api.privateMaterials(request()),503);assert(!state.calls.some(c=>c.kind==='upload'));
reset();await error(await api.privateMaterials(request({origin:'https://evil.invalid'})),403);
reset();await error(await api.privateMaterials(request({name:'not.txt'})),400);
reset();await error(await api.privateMaterials(request({contentType:'text/html'})),400);
reset();await error(await api.privateMaterials(request({body:new TextEncoder().encode('not a PDF')})),400);
reset();await error(await api.privateMaterials(request({body:new Uint8Array(contract.ACADEMY_PRIVATE_PDF_MAX_BYTES+1)})),413);
reset();state.writable=false;await error(await api.privateMaterials(request()),403);assert(!state.calls.some(c=>c.kind==='upload'));
reset();state.uploadError=true;await error(await api.privateMaterials(request()),503);assert.equal(state.assets[0].state,'failed');
reset();const success=await api.privateMaterials(request());assert.equal(success.status,201);const {asset}=await success.json();
assert.equal(asset.originalName,'教材.pdf');assert.equal(asset.parentId,uid(102));assert.equal(state.assets[0].state,'ready');
assert.deepEqual(Object.keys(asset).sort(),['audience','byteSize','createdAt','id','originalName','parentId'].sort());
assert(state.calls.some(c=>c.kind==='db'&&c.op==='insert'&&!c.admin));assert(state.calls.some(c=>c.kind==='upload'&&c.admin&&c.options.upsert===false));
assert.equal(state.calls.filter(c=>c.name==='academy_private_asset_writable').length,2);
assert(state.calls.filter(c=>c.name==='academy_private_asset_writable').every(c=>!c.admin));
const listed=await api.privateMaterials(request({method:'GET'}));assert.equal((await listed.json()).assets.length,1);
const downloaded=await api.privateMaterialDownload(request({method:'GET',suffix:`/${asset.id}`}),asset.id);
assert.equal(downloaded.status,200);assert(downloaded.headers.get('content-disposition').startsWith('attachment;'));assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()),pdf);
state.expireDuringDownload=true;await error(await api.privateMaterialDownload(request({method:'GET'}),asset.id),404);
state.expireDuringDownload=false;state.visible=false;const count=state.calls.filter(c=>c.kind==='download').length;
await error(await api.privateMaterialDownload(request({method:'GET'}),asset.id),404);assert.equal(state.calls.filter(c=>c.kind==='download').length,count);
reset();const parentResponse=await api.createPrivateInstructorMaterial(request({suffix:'/instructor-parent',contentType:'application/json',body:JSON.stringify({courseId:uid(101),title:'講師資料',requiresActive:true,isPublished:false,url:'https://evil.invalid',headquartersId:uid(200)})}));
assert.equal(parentResponse.status,201);const parent=(await parentResponse.json()).material;assert.equal(parent.url,null);assert.equal(parent.deliveryMode,'private_file');
const insert=state.calls.find(c=>c.kind==='db'&&c.table==='academy_materials'&&c.op==='insert');assert.equal(insert.admin,false);assert.equal(insert.payload.headquarters_id,uid(100));assert.equal(insert.payload.url,null);
await error(await api.createPrivateInstructorMaterial(request({suffix:'/instructor-parent',contentType:'application/json',body:'{'})),400);
const source=fs.readFileSync('lib/academy/private-material-server.ts','utf8');assert(!source.includes('createSignedUrl'));assert(!source.includes('getPublicUrl'));
console.log('Academy private material contract/API tests passed (mock Supabase transport; real Request/Response).');
