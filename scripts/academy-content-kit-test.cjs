const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const root = path.resolve(__dirname,'..');
function load(name) {
  if (name.endsWith('.css')) return new Proxy({}, { get: (_, key) => key });
  let file = path.resolve(root,name);
  if (!fs.existsSync(file)) file = ['.tsx','.ts','.js'].map(ext=>file+ext).find(fs.existsSync);
  const result = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}});
  const module = {exports:{}};
  const localRequire = name => name.startsWith('@/') ? load(name.slice(2)) : name.startsWith('.') ? load(path.relative(root,path.resolve(path.dirname(file),name))) : require(name);
  new Function('require','module','exports',result.outputText)(localRequire,module,module.exports);
  return module.exports;
}
const {academyContent,contentToAcademy,replaceAcademyContent} = load('lib/academy/content-adapter.ts');
const legacy = [
 {type:'heading',text:'旧見出し'}, {type:'text',text:'文章\n続き'},
 {type:'image',url:'https://example.com/a.jpg',caption:'画像',linkUrl:'https://example.com/item'},
 {type:'video',url:'https://example.com/video',caption:'動画'},
 {type:'links',title:'リンク',items:[{label:'外部',url:'https://example.com/'}]},
 {type:'image-text',imageUrl:'https://example.com/b.jpg',heading:'左右',text:'本文',linkUrl:'https://example.com/b'},
 {type:'gallery',images:[{url:'https://example.com/c.jpg',caption:'一枚',linkUrl:'https://example.com/c'}]},
 {type:'cta',heading:'申込',buttonLabel:'進む',buttonUrl:'https://example.com/apply'},
 {type:'materials-list'}
];
const snapshot = JSON.stringify(legacy);
const content = academyContent(legacy);
assert.equal(content.length,8);
const stored = replaceAcademyContent(legacy,content);
assert.deepEqual(stored.map(({content,contentVersion,...b})=>b),legacy);
assert.equal(JSON.stringify(legacy),snapshot);
assert.deepEqual(academyContent(JSON.parse(JSON.stringify(stored))),content);
assert.equal(stored.filter(b=>b.type==='materials-list').length,1);
assert.ok(!JSON.stringify(content).includes('materials-list'));
const rich = [
 {id:'p',type:'paragraph',text:'太字リンク',align:'center',richText:[{text:'太字',bold:true},{text:'リンク',strike:true,href:'https://example.com/'}]},
 {id:'q',type:'quote',text:'引用',attribution:'著者'},
 {id:'l',type:'list',items:['一','二']}, {id:'d',type:'divider'},
 {id:'v',type:'video',url:'https://example.com/video',title:'動画'},
 {id:'i',type:'image-text',imageUrl:'https://example.com/a.jpg',imageSide:'right',text:'本文'},
 {id:'g',type:'gallery',columns:2,images:[{url:'https://example.com/g.jpg',alt:'説明',caption:'写真',href:'https://example.com/item'}]}
];
assert.deepEqual(academyContent(JSON.parse(JSON.stringify(contentToAcademy(rich)))),rich);
const {PageBlocks} = load('components/academy/PageBlocks.tsx');
const html = renderToStaticMarkup(React.createElement(PageBlocks,{blocks:contentToAcademy(rich)}));
for(const token of ['font-weight:700','line-through','text-align:center','<blockquote','<ul','sm:order-2','https://example.com/item']) assert.ok(html.includes(token),token);
const unsafe = [{id:'bad',type:'paragraph',text:'危険',richText:[{text:'危険',href:'javascript:alert(1)'}]},{id:'url',type:'link',url:'javascript:alert(1)'}];
assert.ok(!renderToStaticMarkup(React.createElement(PageBlocks,{blocks:contentToAcademy(unsafe)})).includes('javascript:'));
const oldHtml=renderToStaticMarkup(React.createElement(PageBlocks,{blocks:legacy}));
const anchorHtml=renderToStaticMarkup(React.createElement(PageBlocks,{blocks:contentToAcademy([{id:'anchor',type:'cta',buttonLabel:'申し込む',url:'#application'}])}));
assert.ok(anchorHtml.includes('href="#application"'));
assert.ok(anchorHtml.includes('申し込む'));
assert.ok(oldHtml.includes('旧見出し'));
assert.ok(!oldHtml.includes('添付資料・リンク'));
for(const dir of ['components/mikkeos/content','lib/mikkeos/content']) for(const file of fs.readdirSync(path.join(root,dir))) {
 const source = fs.readFileSync(path.join(root,dir,file),'utf8');
 assert.ok(!/from\s+["']@\/lib\/media/.test(source),file);
}
console.log('PASS: 8 legacy blocks, no mutation, bidirectional JSON, rich formatting, layouts, materials isolation, safe links, shared renderer');
