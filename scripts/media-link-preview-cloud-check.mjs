import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { isIP } from "node:net";
import vm from "node:vm";
import ts from "typescript";
function load(file,imports,globals={}) {
  const exports={};const code=ts.transpileModule(readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,{exports,URL,Buffer,TextDecoder,Response,Request,setTimeout,clearTimeout,process:{env:{NODE_ENV:"production",NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_ANON_KEY:"fixture"}},...globals,require:name=>{if(!(name in imports))throw Error(name);return imports[name];}});return exports;
}
let actor={id:"fixture-owner",is_anonymous:false};let calls=0;
const route=load("app/api/media/link-preview/route.ts",{
  "@supabase/supabase-js":{createClient:()=>({auth:{getUser:async()=>({data:{user:actor},error:null})}})},
  "@/lib/media-app/link-preview-server":{getLinkPreview:async url=>{calls++;return {title:"card",description:"description",imageUrl:"https://example.com/image.webp",url};}}
});
const make=(body='{"url":"https://example.com"}',extra={})=>new Request("https://media.example/api/media/link-preview",{method:"POST",headers:{origin:"https://media.example",host:"media.example",authorization:"Bearer fixture",...extra},body});
assert.equal((await route.POST(make(undefined,{origin:"https://evil.example"}))).status,403);
assert.equal((await route.POST(make(undefined,{authorization:""}))).status,401);
actor={id:"anon",is_anonymous:true};assert.equal((await route.POST(make())).status,401);
actor={id:"fixture-owner",is_anonymous:false};
assert.equal((await route.POST(make("x".repeat(4097)))).status,413);
const response=await route.POST(make());assert.equal(response.status,200);assert.equal((await response.json()).title,"card");assert.equal(calls,1);
for(let i=0;i<28;i++)await route.POST(make());assert.equal((await route.POST(make())).status,429);

let addresses=["93.184.216.34"];let redirect;let requests=0;let pinned;
const server=load("lib/media-app/link-preview-server.ts",{
  "node:net":{isIP},"node:dns/promises":{resolve4:async()=>addresses},
  "node:https":{request(url,options,callback){requests++;options.lookup(url.hostname,{all:false},(_error,address)=>{pinned=address;});const req=new EventEmitter();req.destroy=error=>req.emit("error",error);req.end=()=>queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=redirect?302:200;res.headers=redirect?{location:redirect}:{"content-type":"text/html"};res.resume=()=>req.emit("close");callback(res);if(!redirect){res.emit("data",Buffer.from('<title>Hello</title><meta property="og:description" content="Description">'));res.emit("end");req.emit("close");}});return req;}}
},{queueMicrotask});
assert.equal((await server.getLinkPreview("https://example.com")).title,"Hello");assert.equal(pinned,addresses[0]);
addresses=["127.0.0.1"];const before=requests;await assert.rejects(()=>server.getLinkPreview("https://example.com"));assert.equal(requests,before);
addresses=["93.184.216.34","10.0.0.1"];await assert.rejects(()=>server.getLinkPreview("https://example.com"));assert.equal(requests,before);
addresses=["93.184.216.34"];redirect="http://127.0.0.1/secret";await assert.rejects(()=>server.getLinkPreview("https://example.com"));
assert.throws(()=>server.publicWebUrl("https://user:password@example.com"));
assert.throws(()=>server.publicWebUrl("https://127.0.0.1"));
assert.throws(()=>server.publicWebUrl("https://example.local"));
console.log("PASS: production auth/origin/body/rate gates; metadata response; public DNS pinning and redirect SSRF rejection");
