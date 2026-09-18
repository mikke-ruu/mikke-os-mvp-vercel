import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compiled=ts.transpileModule(fs.readFileSync('lib/media-app/social-cloud.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture({start='reader-a',onRpc}={}){
 let subject=start,listener,called=0,unsubscribed=false;
 const fire=(id,event='SIGNED_IN')=>{subject=id;listener?.(event,id?{user:{id}}:null);};
 const supabase={auth:{onAuthStateChange(fn){listener=fn;return {data:{subscription:{unsubscribe(){unsubscribed=true;}}}};},async getUser(){return {data:{user:subject?{id:subject,is_anonymous:false}:null},error:null};}},async rpc(){called++;await onRpc?.(fire);return {data:{ok:true},error:null};}};
 const exports={};vm.runInNewContext(compiled,{exports,require:()=>({supabase}),Error});
 return {call:exports.mediaSocialRpc,state:()=>({called,unsubscribed})};
}
let f=fixture();assert.deepEqual(JSON.parse(JSON.stringify(await f.call('media_reader_home',{},'reader-a'))),{ok:true});assert.equal(f.state().unsubscribed,true);
f=fixture({start:'reader-b'});await assert.rejects(f.call('media_reader_home',{},'reader-a'));assert.equal(f.state().called,0);
f=fixture({onRpc:fire=>{fire('reader-b');fire('reader-a');}});await assert.rejects(f.call('media_reader_home',{},'reader-a'));assert.equal(f.state().unsubscribed,true);
f=fixture({onRpc:fire=>fire('reader-a')});await f.call('media_reader_home',{},'reader-a');
f=fixture({start:null,onRpc:fire=>fire('reader-b')});await assert.rejects(f.call('media_social_read',{},null));
console.log('PASS social identity guard: same owner refresh, mismatch, sticky A-B-A, guest-to-member and cleanup');
