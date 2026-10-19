// Isolated UI fixture using the real roster components and CSS. No credentials,
// Supabase connection, or production route. Run with node; bind localhost only.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const modules = {};
const raw = (id, file) => { modules[id] = fs.readFileSync(path.join(root, "node_modules", file), "utf8"); };
raw("react", "react/cjs/react.development.js");
raw("react/jsx-runtime", "react/cjs/react-jsx-runtime.development.js");
raw("react-dom", "react-dom/cjs/react-dom.development.js");
raw("react-dom/client", "react-dom/cjs/react-dom-client.development.js");
raw("scheduler", "scheduler/cjs/scheduler.development.js");
raw("lucide-react", "lucide-react/dist/cjs/lucide-react.js");
function source(id, relative, suffix = "") {
  modules[id] = ts.transpileModule(fs.readFileSync(path.join(root, relative), "utf8") + suffix, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
}
source("@/lib/team-works-labels", "lib/team-works-labels.ts");
source("@/lib/team-works-feature-settings", "lib/team-works-feature-settings.ts");
source("@/lib/japanese-calendar", "lib/japanese-calendar.ts");
source("@/lib/supabase-schema-compat", "lib/supabase-schema-compat.ts");
source("@/lib/team-works-roster-names", "lib/team-works-roster-names.ts");
source("@/lib/team-works-operations-client", "lib/team-works-operations-client.ts");
source("@/components/mikkeos/MikkeSection", "components/mikkeos/MikkeSection.tsx");
source("@/components/mikkeos/MikkeEmptyState", "components/mikkeos/MikkeEmptyState.tsx");
source("@/components/team-works/TeamWorksViewAsContext", "components/team-works/TeamWorksViewAsContext.tsx");
source("portal", "components/team-works/operations/TeamWorksOperationsClientPortal.tsx", "\nexport { ProjectRosterTab, RosterEditor };\n");
source("portal-share", "components/team-works/operations/TeamWorksPortalShare.tsx");
function bundleDependency(file) {
  if (modules[file]) return file;
  modules[file] = "// loading";
  modules[file] = fs.readFileSync(file, "utf8").replace(/require\(['"]([^'"]+)['"]\)/g, (_, dependency) => {
    const resolved = require.resolve(dependency, { paths: [path.dirname(file)] });
    return `require(${JSON.stringify(bundleDependency(resolved))})`;
  });
  return file;
}
const qrModule = bundleDependency(require.resolve("qrcode/lib/browser.js"));
modules.qrcode = `exports.default = require(${JSON.stringify(qrModule)});`;
modules["next/link"] = "module.exports = ({children, ...props}) => require('react').createElement('a',props,children);";
modules["@/components/team-works/useTeamWorksLabels"] = "exports.useTeamWorksLabels = () => require('@/lib/team-works-labels').DEFAULT_LABELS;";
for (const id of ["@/components/team-works/operations/ClientMonthCalendar", "@/components/team-works/client-projects/TeamWorksClientProjectsShell", "@/components/team-works/operations/TeamWorksDirectorySelfProfile", "@/lib/team-works-portal-sample-data"]) modules[id] = "module.exports = {};";
modules["@/lib/supabase/client"] = `
const db = window.fixture;
exports.supabase = {
  auth: { getUser: async () => ({ data:{user:{id:'test-user'}}, error:null }) },
  from(table) {
    let patch, id;
    const q = {
      select(){return q}, in(){return q},
      eq(key,value){if(key==='id') id=value; return q},
      update(value){patch=value;return q}, maybeSingle(){return q},
      then(resolve,reject) {
        let data;
        if(table==='team_works_organization_members') data=[{id:'client'}];
        else if(table==='team_works_project_members') data={organization_member_id:'client'};
        else if(table==='team_works_participants' && patch) {
          if(db.fail) return Promise.resolve({data:null,error:new Error('テスト用の保存エラー')}).then(resolve,reject);
          db.writes.push({id,patch}); db.people=db.people.filter(p=>p.id!==id); data={id};
        } else throw new Error('Unexpected fixture query: '+table);
        return Promise.resolve({data,error:null}).then(resolve,reject);
      }
    }; return q;
  }
};`;
modules.entry = `
const React=require('react');
const {createRoot}=require('react-dom/client');
const {ProjectRosterTab,RosterEditor}=require('portal');
const {TeamWorksViewAsProvider}=require('@/components/team-works/TeamWorksViewAsContext');
const project={id:'p',title:'テスト用の学校'};
const session={id:'s',projectId:'p',roster:[{id:'r',participantId:'b',participantName:'確認用の生徒',orderIndex:1}]};
function App(){
  const [,refresh]=React.useState(0);
  if(new URLSearchParams(location.search).has('share')) return React.createElement('main',{style:{maxWidth:1000,margin:'auto',padding:16}},React.createElement('h1',null,'ポータルを共有'),React.createElement(require('portal-share').TeamWorksPortalShare));
  const mutate=async(action,text)=>{try{await action();refresh(n=>n+1);return {tone:'success',text}}catch(e){return {tone:'error',text:e.message}}};
  const viewAs=new URLSearchParams(location.search).has('readonly')?{role:'client',organizationMemberId:'client',displayName:'確認用'}:null;
  return React.createElement(TeamWorksViewAsProvider,{value:viewAs},
    React.createElement('main',{style:{maxWidth:1000,margin:'auto',padding:16}},
      React.createElement('h1',null,'Team Works 名簿の削除確認（架空データ）'),
      React.createElement(ProjectRosterTab,{data:{groups:[],participants:window.fixture.people},project,mutate}),
      React.createElement('h2',{style:{marginTop:24}},'登録済みの予定'),
      React.createElement(RosterEditor,{session,participants:window.fixture.people,groups:[],mutate})
    ));
}
createRoot(document.getElementById('root')).render(React.createElement(App));`;
const setup = `window.fixture={fail:false,writes:[],people:[{id:'a',projectId:'p',name:'残す生徒',groupId:null,level:'初級'},{id:'b',projectId:'p',name:'確認用の生徒',groupId:null,level:null}]};`;
const bundle = `${setup}\nconst process={env:{NODE_ENV:'development'}}; const sources=${JSON.stringify(modules)}; const loaded={}; function require(id){if(loaded[id])return loaded[id].exports;if(!sources[id])throw new Error('Missing module '+id);const m={exports:{}};loaded[id]=m;new Function('require','module','exports','process',sources[id])(require,m,m.exports,process);return m.exports}require('entry');`;
(async()=>{
  const cssFile=path.join(root,"app/globals.css");
  const css=await require("postcss")([require("@tailwindcss/postcss")({base:root})]).process(fs.readFileSync(cssFile,"utf8"),{from:cssFile});
  const server=http.createServer((req,res)=>{
    if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(bundle);return}
    if(req.url==='/fixture.css'){res.setHeader('Content-Type','text/css; charset=utf-8');res.end(css.css);return}
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>名簿削除のローカル確認</title><link rel="stylesheet" href="/fixture.css"><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
  });
  const port=Number(process.env.TEAM_WORKS_PREVIEW_PORT || 4387);
  server.listen(port,'127.0.0.1',()=>console.log('Fixture: http://127.0.0.1:'+port+' (in-memory rows only)'));
})().catch(e=>{console.error(e);process.exitCode=1});
