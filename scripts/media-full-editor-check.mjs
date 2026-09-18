import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
const jsx=(type,props)=>({type,props});
function load(path,imports={}) {
  const exports={};
  const code=ts.transpileModule(readFileSync(new URL(`../${path}`,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,allowJs:true}}).outputText;
  vm.runInNewContext(code,{exports,crypto:{randomUUID},URL,require(name){if(name in imports)return imports[name];throw Error(name);}});
  return exports;
}
const react={Fragment:"fragment",useRef:()=>({current:null}),useEffect(){}};
const factories=load("lib/mikkeos/content/blocks.js");
const rich=load("lib/mikkeos/content/rich-text.ts");
const editor=load("components/mikkeos/content/MikkeContentEditor.tsx",{
  react,"react/jsx-runtime":{jsx,jsxs:jsx},"lucide-react":{},
  "@/lib/mikkeos/content/blocks.js":factories,"./MikkeInsertMenu":{MikkeInsertMenu:"menu"},
  "@/lib/mikkeos/content/rich-text":rich
});
function nodes(tree){if(!tree||typeof tree!=="object")return[];return [tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];}
let changed;let split;
const original={id:"p",type:"paragraph",text:"ABCDEF",align:"center",richText:[{text:"ABC",bold:true},{text:"DEF",href:"https://example.com"}]};
let tree=editor.MikkeContentEditor({blocks:[original],onChange:v=>changed=v,renderBlock(_block,_change,onSplit){split=onSplit;}});
split(2,4);
assert.equal(changed[0].text,"AB");assert.equal(changed[1].text,"EF");
assert.equal(changed[0].richText[0].bold,true);assert.equal(changed[1].richText[0].href,"https://example.com");
assert.equal(changed[1].align,"center");
for(const block of changed)assert.equal(block.richText.map(run=>run.text).join(""),block.text);
const types=["paragraph","heading","image","quote","list","divider","link","video","links","image-text","gallery","cta"];
for(const type of types){nodes(tree).find(n=>n.type==="menu").props.onInsert(type);assert.equal(changed[0].type,type);}

const layout=load("components/mikkeos/content/MikkeLayoutFields.tsx",{"react/jsx-runtime":{jsx,jsxs:jsx}});
let picker;
layout.MikkeLayoutFields({block:{id:"it",type:"image-text",imageUrl:"",text:"body"},onChange:v=>changed=v,pickImage(_url,callback){picker=callback;}});
picker("/api/media/assets/asset","asset");assert.equal(changed.imageAssetId,"asset");assert.equal(changed.text,"body");
layout.MikkeLayoutFields({block:{id:"g",type:"gallery",images:[{url:"",alt:"description"}]},onChange:v=>changed=v,pickImage(_url,callback){picker=callback;}});
picker("/api/media/assets/asset","asset");assert.equal(changed.images[0].assetId,"asset");assert.equal(changed.images[0].alt,"description");
// Existing Academy pickers may still pass only a URL.
picker("https://example.com/image.png");assert.equal(changed.images[0].url,"https://example.com/image.png");

const {validPublicBlock}=load("lib/media-app/public-blocks.ts");
assert.ok(validPublicBlock(original));
assert.equal(validPublicBlock({...original,richText:[{text:"different"}]}),false);
assert.equal(validPublicBlock({...original,richText:[{text:"ABCDEF",href:"javascript:alert(1)"}]}),false);
assert.equal(validPublicBlock({...original,imageAssetId:"hidden"}),false);
assert.ok(validPublicBlock({id:"g",type:"gallery",columns:2,images:[{url:"/media/images/"+"a".repeat(64),alt:"description",href:"https://example.com"}]}));
assert.equal(validPublicBlock({id:"g",type:"gallery",images:[{url:"/media/images/"+"a".repeat(64),alt:"description",assetId:"private"}]}),false);
assert.ok(validPublicBlock({id:"v",type:"video",url:"https://youtu.be/abcdefghijk"}));
console.log("PASS: all 12 insertions, rich split marks/alignment, asset-aware and legacy pickers, public DTO injection rejection");
