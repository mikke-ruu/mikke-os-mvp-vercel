const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const source=fs.readFileSync(path.join(__dirname,'../components/team-works/operations/TeamWorksOperationsPartnerPortal.tsx'),'utf8');
const defaults={presence:true,zoom:true,roster:true,timer:true,manualLink:true};
const labels=new Proxy({},{get:(_,key)=>({workers:'パートナー',sessionNoun:'授業',manualNoun:'マニュアル',reportNoun:'報告',participantNoun:'参加者',attendanceNoun:'出席',startAction:'開始',endAction:'終了'}[key]||String(key))});
const mod={exports:{}};
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
new Function('require','module','exports',js)(name=>{
 if(['react','react/jsx-runtime','lucide-react'].includes(name))return require(name);
 if(name.endsWith('useTeamWorksLabels'))return {useTeamWorksLabels:()=>labels};
 if(name.endsWith('TeamWorksViewAsContext'))return {useIsViewAs:()=>false,useViewAs:()=>({})};
 if(name.endsWith('team-works-feature-settings'))return {DEFAULT_WORK_WINDOW_SETTINGS:defaults};
 if(name.endsWith('supabase/client'))return {supabase:{}};
 return new Proxy({},{get:()=>({children})=>React.createElement(React.Fragment,null,children)});
},mod,mod.exports);
const session={id:'session',projectId:'project',projectTitle:'研修確認用',sessionDate:'2026-10-22',startTime:'13:00',durationMin:60,status:'scheduled',zoomUrl:null,zoomMeetingId:null,zoomPasscode:null,partnerPresenceStatus:'in_progress',reportSubmitted:false,manuals:[{no:1,title:'最初のマニュアル',body:'確認用教材',questions:[],expressions:[],cautions:null},{no:2,title:'次のマニュアル',body:'次の教材',questions:[],expressions:[],cautions:null}],roster:[{id:'roster',orderIndex:1,participantId:'student',participantName:'確認用参加者',attendanceStatus:'present',currentManualNo:1,assessment:{responseSmoothness:3,comprehension:4,speakingConfidence:2},handoffNote:'主担当が保存したメモ',completedAt:null}]};
function render(training){return renderToStaticMarkup(React.createElement(mod.exports.TeamWorksPartnerLessonConsole,{session:{...session,isTraining:training},onRefresh:async()=>{},standalone:false,workWindow:defaults}))}
const training=render(true),primary=render(false);
assert.ok(training.includes('研修担当・閲覧のみ'));
assert.ok(training.includes('主担当が保存したメモ'));
assert.ok(!training.includes('Zoom設定を保存'));
assert.ok(!training.includes('報告を提出'));
assert.ok(!training.includes('textarea'));
assert.ok(training.includes('aria-label="マニュアル番号"'));
assert.ok(training.includes('>No.2</button>'));
assert.ok(primary.includes('報告を提出'));
console.log('PASS training renders saved progress/manual choices without save forms; primary keeps report controls');
if(process.argv.includes('--html')) fs.writeFileSync(path.join(__dirname,'../training-review.html'),'<!doctype html><meta charset="utf-8"><title>研修担当の表示確認</title><style>body{font:16px sans-serif;max-width:1000px;margin:24px auto}button,select{padding:8px;margin:4px}button:disabled{opacity:.4}svg{width:18px;height:18px}header,li,section{border:1px solid #ddd;padding:12px}li{list-style:none}textarea{display:block}</style>'+training);
