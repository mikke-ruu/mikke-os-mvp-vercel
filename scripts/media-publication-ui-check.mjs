import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the real component handlers, including clicks before React rerenders.
const source = readFileSync(new URL("../components/media-app/MediaCloudPublication.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
const slots=[];let cursor=0;const effects=[];
let publishCalls=0, resolvePublish, rejectPublish;
const terms={termsVersion:"test",documentSha256:"hash",documentUrl:"/terms",accepted:true};
const repository={
  reviewArticle:async()=>({expectedRevision:"reviewed-hash",snapshot:{title:"Test",site:{name:"Test",authorName:"Author"}}}),
  currentTerms:async()=>terms,
  publishReviewedArticle:(...args)=>{publishCalls++;assert.equal(args[1],"reviewed-hash");return new Promise((resolve,reject)=>{resolvePublish=resolve;rejectPublish=reject;});}
};
const hooks={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==="function"?v(slots[i]):v;}];},
  useRef(initial){const i=cursor++;return slots[i]??= {current:initial};},
  useMemo(fn){const i=cursor++;return slots[i]??=fn();},
  useEffect(fn){const i=cursor++;if(!(i in slots)){slots[i]=true;effects.push(fn);}}
};
const jsx=(type,props)=>({type,props});
const module={exports:{}};
vm.runInNewContext(compiled,{module,exports:module.exports,Date,Error,require(id){
  if(id==="react")return hooks;
  if(id==="react/jsx-runtime")return {jsx,jsxs:jsx,Fragment:"fragment"};
  if(id.includes("AuthGate"))return {useAuth:()=>({profile:{user_id:"owner"}})};
  if(id.includes("supabase/client"))return {supabase:{}};
  if(id.includes("cloud-repository"))return {createMediaCloudRepository:()=>repository};
  if(id.includes("MediaArticleRenderer"))return {MediaArticleRenderer:()=>null};
  throw Error(id);
}});
const Component=module.exports.MediaCloudPublication;
let published=0;
function render(){cursor=0;return Component({articleId:"article",updating:true,onCancel(){},onPublished(){published++;}});}
function nodes(node){if(!node||typeof node!=="object")return [];return [node,...[node.props?.children].flat(Infinity).flatMap(nodes)];}
function text(node){if(typeof node==="string")return node;return [node?.props?.children].flat(Infinity).map(text).join("");}
function button(tree){return nodes(tree).find(n=>n.type==="button"&&text(n)==="この内容に更新する");}
function confirm(tree){for(const n of nodes(tree).filter(n=>n.type==="input"))n.props.onChange({target:{checked:true}});}
render();for(const effect of effects)effect();await new Promise(resolve=>setImmediate(resolve));
assert.equal(button(render()).props.disabled,true);
confirm(render());let tree=render();assert.equal(button(tree).props.disabled,false);
const first=button(tree).props.onClick();const repeated=button(tree).props.onClick();
assert.equal(publishCalls,1,"Repeated clicks must not create multiple publication requests");
rejectPublish(new Error("changed revision"));await Promise.all([first,repeated]);
tree=render();assert.equal(button(tree).props.disabled,true,"Failure requires fresh rights confirmation");
assert.equal(published,0);
confirm(tree);tree=render();const retry=button(tree).props.onClick();
assert.equal(publishCalls,2);resolvePublish({id:"article"});await retry;
assert.equal(published,1);
console.log("Publication UI: required confirmations, update label, duplicate request prevention, failure reset and retry PASS");
