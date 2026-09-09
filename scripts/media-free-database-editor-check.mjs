import assert from 'node:assert/strict';
import {openMediaDatabaseEditor} from '../lib/media-app/database-editor.ts';
let subject='A'; let anonymous=false; let listener=()=>{}; const events=[];
let release; let delayed=false;
const operations={mediaDatabaseTransport:{readSession:async()=>subject?{subject,isAnonymous:anonymous}:null,subscribeSessionChange:fn=>{listener=fn;return()=>{};}},
 listMyMediaSitesFromDatabase:async()=>[{id:'site-a',publishing_policy:'direct_owner'}],
 readMediaArticleDraftFromDatabase:async id=>id==='article-a'?{id,site_id:'site-a',title:'draft'}:null,
 updateMediaArticleDraftInDatabase:async(id,input)=>{events.push(['save',input]);if(delayed)await new Promise(r=>{release=r;});return {id,...input};},
 createMediaArticleDraftInDatabase:async()=>{events.push(['create']);return {};},
 publishMediaArticleInDatabase:async()=>{events.push(['publish']);return 'version';},
 unpublishMediaArticleInDatabase:async()=>{events.push(['cancel']);}};
const editor=await openMediaDatabaseEditor(operations);
const input={title:'first',slug:'first',blocks:[]};
assert.equal((await editor.load('other')).status,'failed');
assert.equal((await editor.create('other',input)).status,'failed');
assert.equal(events.length,0);
assert.equal((await editor.save('article-a',input)).status,'ok');
assert.equal((await editor.cancelPublication('article-a')).status,'ok');
assert.equal(events.at(-1)[0],'cancel');
assert.equal((await editor.publish('article-a',{termsVersion:'',rightsConfirmed:true,privacyConfirmed:true,affiliateFreeConfirmed:true})).status,'failed');
assert.equal(events.filter(e=>e[0]==='publish').length,0);
delayed=true;
const first=editor.save('article-a',input);
while(!release) await new Promise(r=>setTimeout(r,1));
const second=editor.save('article-a',{...input,title:'second'});
subject='B'; listener(); release();
assert.equal((await first).status,'session_changed');
assert.equal((await second).status,'session_changed');
assert.equal(events.filter(e=>e[0]==='save').length,2);
assert.equal((await editor.cancelPublication('article-a')).status,'session_changed');
editor.dispose();
subject=null; assert.equal(await openMediaDatabaseEditor(operations),null);
subject='A';anonymous=true;assert.equal(await openMediaDatabaseEditor(operations),null);
console.log('Database editor: scoped access, serialized writes, session change, stale response, anonymous refusal and explicit cancel PASS');
