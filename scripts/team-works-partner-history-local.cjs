// Local-only review harness. Uses the production React component and migration,
// with fictitious identities instead of Supabase Auth. Never imported by the app.
const fs=require('fs'),path=require('path'),http=require('http'),ts=require('typescript');
const root=path.resolve(__dirname,'..');process.chdir(root);
const out=path.join(root,'artifacts/partner-history/local');fs.mkdirSync(out,{recursive:true});
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const {PGlite}=require(process.env.PGLITE_MODULE||'G:/Musubiプロジェクト/tmp/team-works-invite-tests/node_modules/@electric-sql/pglite');
const db=new PGlite(path.join(out,'database'));
function compile(input,output){fs.writeFileSync(path.join(out,output),ts.transpileModule(fs.readFileSync(input,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText);}
async function init(){
 if(!(await db.query("select to_regclass('public.team_works_partner_lesson_history') as name")).rows[0].name){
  const fixture=fs.readFileSync('scripts/team-works-partner-history-db-test.cjs','utf8');
  const schema=fixture.split('await db.exec(`')[1].split('`);')[0];await db.exec(schema);
  await db.query("insert into auth.users values($1,'partner@example.invalid'),($2,'hq@example.invalid')",[id(1),id(3)]);
  await db.query("insert into team_works_organization_members values($1,$3,$1,'確認用パートナー','worker','active'),($2,$3,$2,'確認用本部','manager','active')",[id(1),id(3),id(10)]);
  await db.query('insert into team_works_organizations values($1,$2)',[id(10),id(3)]);
  await db.query("insert into team_works_partners values($1,$2,'確認用パートナー','partner@example.invalid')",[id(11),id(10)]);
  await db.query("insert into team_works_projects values($1,$2,'サンプルプロジェクト','operations')",[id(20),id(10)]);
  await db.query("insert into team_works_project_members values($1,$2,'worker')",[id(20),id(1)]);
  await db.query("insert into team_works_project_partner_settings values($1,$2,1200,'active')",[id(20),id(1)]);
  await db.exec(fs.readFileSync('supabase/migrations/20261106133009_team_works_partner_lesson_history.sql','utf8'));
  await db.exec(`alter table team_works_project_partner_settings enable row level security;
   create policy local_staff_settings on team_works_project_partner_settings for update to authenticated using(private.team_works_is_project_staff(project_id)) with check(private.team_works_is_project_staff(project_id));
   create policy local_read_settings on team_works_project_partner_settings for select to authenticated using(private.team_works_is_project_staff(project_id) or organization_member_id=auth.uid());
   grant select,update on team_works_project_partner_settings to authenticated;
   alter table team_works_op_sessions enable row level security;
   create policy local_staff_sessions on team_works_op_sessions for all to authenticated using(private.team_works_is_project_staff(project_id)) with check(private.team_works_is_project_staff(project_id));
   grant select,update on team_works_op_sessions to authenticated;`);
  for(const n of [30,31,32]){
   if(n===31)await db.exec("update team_works_project_partner_settings set calculation_basis='actual'");
   await db.query("insert into team_works_op_sessions values($1,$2,$3,null,(now() at time zone 'Asia/Tokyo')::date,'00:00',45,$4,'not_started')",[id(n),id(20),id(1),n===32?'scheduled':'completed']);
  }
 }
 const draft=fs.readFileSync('supabase/migrations/20261106133009_team_works_partner_lesson_history.sql','utf8');
 if(!(await db.query("select 1 from information_schema.columns where table_name='team_works_partner_lesson_history' and column_name='actual_start_time'")).rows.length){
  await db.exec(draft.split('-- actual-clock-fields: also used to upgrade the isolated local review database.')[1].split('-- end-actual-clock-fields')[0]);
 }
 const rpc=draft.slice(draft.indexOf('create function private.team_works_partner_history')).replaceAll('create function ','create or replace function ');
 await db.exec(rpc);
 compile('components/team-works/operations/TeamWorksPartnerHistory.tsx','component.js');
 compile('lib/team-works-partner-history.ts','helpers.js');
 fs.writeFileSync(path.join(out,'adapter.js'),`
 async function api(body){const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,role:location.pathname==='/self'?'self':'staff'})});const result=await r.json();if(!r.ok)throw Error(result.error||'保存できませんでした。');return result;}
 exports.supabase={rpc:async(name,args)=>{try{return {data:await api({op:'read',args}),error:null}}catch(error){return {data:null,error}}},from(table){let value,filters={};const q={update(v){value=v;return q},eq(k,v){filters[k]=v;return q},is(k,v){filters[k]=v;return q},select(){return q},async single(){try{return {data:await api({op:'update',table,value,filters}),error:null}}catch(error){return {data:null,error}}}};return q}};
 exports.updateOperationsProjectPartnerSetting=async(_client,input)=>{await api({op:'rate',input})};`);
 fs.writeFileSync(path.join(out,'entry.js'),`
 const React=require('react'),{createRoot}=require('react-dom/client');
 const {TeamWorksPartnerHistory}=require('./component');
 createRoot(document.getElementById('root')).render(React.createElement(TeamWorksPartnerHistory,{partnerId:location.pathname==='/self'?null:'${id(11)}'}));`);
 const webpackModule=require('next/dist/compiled/webpack/webpack');
 await new Promise((resolve,reject)=>webpackModule.webpack({mode:'development',devtool:false,entry:path.join(out,'entry.js'),output:{path:out,filename:'bundle.js'},resolve:{alias:{'@/lib/supabase/client':path.join(out,'adapter.js'),'@/lib/team-works-partner-history':path.join(out,'helpers.js'),'@/lib/team-works-operations-project':path.join(out,'adapter.js')}},performance:{hints:false}},(error,stats)=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));
}
async function handle(body){
 if(!['staff','self'].includes(body.role))throw Error('Invalid review role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(body.role==='staff'?3:1)]);await db.exec('set role authenticated');
 try{
  if(body.op==='read'){
   if(!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(body.args.month_start))throw Error('Invalid month');
   return (await db.query('select public.team_works_partner_history($1,$2::date) as data',[body.role==='staff'?id(11):null,body.args.month_start])).rows[0].data;
  }
  if(body.role!=='staff')throw Error('本人画面では編集できません。');
  let result;
  if(body.op==='rate'){
   const x=body.input;
   if(x.hourlyWage!==null&&(!Number.isInteger(x.hourlyWage)||x.hourlyWage<0))throw Error('Invalid wage');
   if(!['actual','scheduled'].includes(x.calculationBasis))throw Error('Invalid basis');
   result=await db.query('update team_works_project_partner_settings set hourly_wage=$1,calculation_basis=$2 where project_id=$3 and organization_member_id=$4 returning project_id',[x.hourlyWage,x.calculationBasis,x.projectId,x.organizationMemberId]);
  }else if(body.op==='update'&&body.table==='team_works_op_sessions'){
   result=await db.query("update team_works_op_sessions set status='completed' where id=$1 and status='scheduled' returning id",[body.filters.id]);
  }else if(body.op==='update'&&body.table==='team_works_partner_lesson_history'){
   const keys=Object.keys(body.value);const clocks=['actual_start_time','actual_end_time','actual_end_next_day','actual_break_minutes'];
   if(keys.length===4&&keys.every(k=>clocks.includes(k))){
    result=await db.query('update team_works_partner_lesson_history set actual_start_time=$1,actual_end_time=$2,actual_end_next_day=$3,actual_break_minutes=$4 where id=$5 returning id',[...clocks.map(k=>body.value[k]),body.filters.id]);
   }else{
    if(keys.length!==1)throw Error('Invalid update');
    const key=keys[0];if(!['actual_minutes','hourly_wage'].includes(key))throw Error('Invalid column');
    result=await db.query('update team_works_partner_lesson_history set '+key+'=$1 where id=$2'+(key==='hourly_wage'?' and hourly_wage is null':'')+' returning id',[body.value[key],body.filters.id]);
   }
  }else throw Error('Unknown operation');
  if(result.rows.length!==1)throw Error('保存対象が見つかりません。');return result.rows[0];
 }finally{await db.exec('reset role');}
}
let queue=Promise.resolve();
init().then(()=>http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:4192');
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.headers.host!=='127.0.0.1:4192'){res.writeHead(403);return res.end();}
 if(url.pathname==='/api'&&req.method==='POST'){
  if(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:4192'){res.writeHead(403);return res.end();}
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192){res.writeHead(413);return res.end();}}
  const task=queue.then(()=>handle(JSON.parse(raw)));queue=task.catch(()=>{});
  try{const data=await task;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));}catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}return;
 }
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 if(['/','/staff','/self'].includes(url.pathname)){
  res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><title>Team Works ローカル操作確認</title><style>:root{--tw-action:#186852;--tw-on-solid:#fff;--mikke-line:#d4dfda;--mikke-surface:#fff;--mikke-text:#152922;--mikke-muted:#52665c}body{background:#f6f8f6;color:#152922;font-family:sans-serif}nav{display:flex;gap:24px;padding:16px 0}nav a{text-decoration:underline}aside{padding:16px;background:#fff3d5;border-radius:12px;margin-bottom:24px}</style><main class="mx-auto max-w-4xl p-4"><h1 class="text-xl font-bold">Team Works ローカル操作確認</h1><nav><a href="/staff">本部として確認</a><a href="/self">パートナーとして確認</a></nav><aside>架空データの確認環境です。保存はこのPCの専用データベースだけに反映されます。通常のログイン・招待は含みません。<br>現在の表示：${url.pathname==='/self'?'パートナー（閲覧のみ）':'本部（編集できます）'}</aside><div id="root"></div><script src="/bundle.js"></script></main></html>`);
 }
 const file=url.pathname==='/bundle.js'?path.join(out,'bundle.js'):url.pathname==='/style.css'?path.join(root,'artifacts/partner-history/style.css'):null;
 if(file&&fs.existsSync(file)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'application/javascript':'text/css');return fs.createReadStream(file).pipe(res);}
 res.writeHead(404);res.end();
}).listen(4192,'127.0.0.1',()=>console.log('Local review ready: http://127.0.0.1:4192/staff (fictitious local database; no real Auth)'))).catch(e=>{console.error(e);process.exitCode=1});
