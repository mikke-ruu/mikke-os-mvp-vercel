import 'server-only';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { ACADEMY_PRIVATE_PDF_MAX_BYTES, isAssetUuid, isPdfBytes, pdfFilename, privateMaterialParent } from './private-material-contract';
import type { AcademyPrivateMaterialAsset, AcademyPrivateMaterialAudience } from './private-material-contract';

const bucket = 'academy-private-materials';
const columns = 'id,audience,learner_page_id,instructor_material_id,original_name,byte_size,created_at,headquarters_id,course_id,state';
const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Authorization', 'X-Content-Type-Options': 'nosniff' };
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
type AssetRow = {
  id: string; audience: AcademyPrivateMaterialAudience; learner_page_id: string | null;
  instructor_material_id: string | null; original_name: string; byte_size: number; created_at: string;
  headquarters_id: string; course_id: string; state: string;
};
function projectAsset(a: AssetRow): AcademyPrivateMaterialAsset {
  return { id: a.id, audience: a.audience, parentId: (a.learner_page_id ?? a.instructor_material_id)!, originalName: a.original_name, byteSize: a.byte_size, createdAt: a.created_at };
}
const keyFor = (a: AssetRow) => `${a.headquarters_id}/${a.course_id}/${a.id}.pdf`;
function json(body: unknown, status=200) { return Response.json(body,{status,headers}); }
async function context(request: Request) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret=process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.ACADEMY_PRIVATE_MATERIALS_ENABLED !== 'true' || !url || !anon || !secret)
    throw new HttpError(503,'資料アップロードは準備中です。');
  const token=request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token) throw new HttpError(401,'ログインしてからお試しください。');
  const boundedFetch: typeof fetch = (input, init) => fetch(input,{...init,cache:'no-store',signal:AbortSignal.any([AbortSignal.timeout(15000),...(init?.signal ? [init.signal] : [])])});
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:boundedFetch}};
  const user=createClient(url,anon,{...options,global:{...options.global,headers:{Authorization:`Bearer ${token}`}}});
  const identity=await user.auth.getUser(token);
  if (identity.error || !identity.data.user || identity.data.user.is_anonymous)
    throw new HttpError(401,'ログインしてからお試しください。');
  const admin=createClient(url,secret,options);
  const ready=await admin.rpc('academy_private_materials_ready');
  if (ready.error || ready.data !== 'private-pdf-v1') throw new HttpError(503,'資料アップロードは準備中です。');
  return {user,admin,userId:identity.data.user.id};
}
type Context = Awaited<ReturnType<typeof context>>;
async function writable(c: Context,id: string) {
  const check=await c.user.rpc('academy_private_asset_writable',{p_asset_id:id});
  if (check.error || check.data !== true) throw new HttpError(403,'この資料を追加する権限がありません。');
}
async function visibleAsset(c: Context,id: string): Promise<AssetRow> {
  const result=await c.user.from('academy_private_material_assets').select(columns).eq('id',id).eq('state','ready').maybeSingle();
  if (result.error || !result.data) throw new HttpError(404,'資料を開けません。公開状態と閲覧期限をご確認ください。');
  return result.data as AssetRow;
}
async function readPdf(request: Request) {
  const declared=Number(request.headers.get('content-length'));
  if (declared > ACADEMY_PRIVATE_PDF_MAX_BYTES) throw new HttpError(413,'PDFは3MB以下で追加してください。');
  if (!request.body) throw new HttpError(400,'PDFを選択してください。');
  const reader=request.body.getReader(), chunks: Uint8Array[]=[];
  let size=0;
  const timeout=AbortSignal.timeout(20000);
  const cancel=() => { void reader.cancel().catch(() => undefined); };
  timeout.addEventListener('abort',cancel,{once:true});
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (timeout.aborted) throw new HttpError(408,'送信に時間がかかっています。もう一度お試しください。');
      if (done) break;
      size+=value.byteLength;
      if (size > ACADEMY_PRIVATE_PDF_MAX_BYTES) { cancel(); throw new HttpError(413,'PDFは3MB以下で追加してください。'); }
      chunks.push(value);
    }
  } finally { timeout.removeEventListener('abort',cancel); reader.releaseLock(); }
  const bytes=new Uint8Array(size); let offset=0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.length; }
  if (!isPdfBytes(bytes)) throw new HttpError(400,'PDFファイルを選択してください。');
  return bytes;
}
export async function privateMaterials(request: Request): Promise<Response> {
  try {
    const c=await context(request);
    const parent=privateMaterialParent(new URL(request.url));
    if (!parent) throw new HttpError(400,'保存先のページを確認してください。');
    const parentColumn=parent.audience==='learner' ? 'learner_page_id' : 'instructor_material_id';
    if (request.method==='GET') {
      const result=await c.user.from('academy_private_material_assets').select(columns).eq('audience',parent.audience).eq(parentColumn,parent.parentId).eq('state','ready').order('created_at',{ascending:false}).limit(100);
      if (result.error) throw new HttpError(503,'資料一覧を読み込めませんでした。');
      return json({assets:(result.data as AssetRow[]).map(projectAsset)});
    }
    if (request.method!=='POST') throw new HttpError(405,'この操作は利用できません。');
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new HttpError(403,'元の画面からお試しください。');
    if (request.headers.get('content-type')?.split(';')[0].trim()!=='application/pdf') throw new HttpError(400,'PDFファイルを選択してください。');
    const name=pdfFilename(request.headers.get('x-academy-filename'));
    if (!name) throw new HttpError(400,'PDFのファイル名を確認してください。');
    // Parent is fetched with the caller's JWT, never the service key.
    const table=parent.audience==='learner' ? 'academy_learner_pages' : 'academy_materials';
    const scope=await c.user.from(table).select('id,headquarters_id,course_id').eq('id',parent.parentId).maybeSingle();
    if (scope.error || !scope.data) throw new HttpError(403,'保存先のページを確認してください。');
    const bytes=await readPdf(request);
    const prepared=await c.user.from('academy_private_material_assets').insert({
      id:randomUUID(),headquarters_id:scope.data.headquarters_id,course_id:scope.data.course_id,
      audience:parent.audience,[parentColumn]:parent.parentId,created_by:c.userId,
      original_name:name,byte_size:bytes.length,state:'pending'
    }).select(columns).single();
    if (prepared.error || !prepared.data) throw new HttpError(403,'この資料を追加できません。編集権限と契約状態をご確認ください。');
    const asset=prepared.data as AssetRow;
    try {
      await writable(c,asset.id);
      const uploaded=await c.admin.storage.from(bucket).upload(keyFor(asset),bytes,{contentType:'application/pdf',upsert:false,cacheControl:'0'});
      if (uploaded.error) throw new HttpError(503,'資料を保存できませんでした。');
      await writable(c,asset.id);
      const finished=await c.admin.from('academy_private_material_assets').update({state:'ready'}).eq('id',asset.id).eq('state','pending').select('id').single();
      if (finished.error || !finished.data) throw new HttpError(503,'資料の保存を完了できませんでした。');
      return json({asset:projectAsset(asset)},201);
    } catch (error) {
      // Retain failed uploads for scoped operational cleanup. Never delete existing material.
      await c.admin.from('academy_private_material_assets').update({state:'failed'}).eq('id',asset.id).eq('state','pending');
      throw error;
    }
  } catch (error) { return json({error:error instanceof HttpError ? error.message : '資料を処理できませんでした。もう一度お試しください。'},error instanceof HttpError ? error.status : 503); }
}
export async function privateMaterialDownload(request: Request,id: string): Promise<Response> {
  try {
    if (!isAssetUuid(id)) throw new HttpError(404,'資料を開けません。');
    const c=await context(request), asset=await visibleAsset(c,id);
    const file=await c.admin.storage.from(bucket).download(keyFor(asset));
    if (file.error || !file.data || file.data.size !== asset.byte_size) throw new HttpError(404,'資料を開けません。');
    // Recheck after storage latency; expiry/unpublish/revocation may have occurred meanwhile.
    await visibleAsset(c,id);
    return new Response(file.data,{headers:{...headers,'Content-Type':'application/pdf','Content-Length':String(file.data.size),
      'Content-Disposition':`attachment; filename="material.pdf"; filename*=UTF-8''${encodeURIComponent(asset.original_name).replace(/['()*]/g,ch=>`%${ch.charCodeAt(0).toString(16)}`)}`,
      'Content-Security-Policy':"sandbox; default-src 'none'"}});
  } catch (error) { return json({error:error instanceof HttpError ? error.message : '資料を開けませんでした。'},error instanceof HttpError ? error.status : 503); }
}

export async function createPrivateInstructorMaterial(request: Request): Promise<Response> {
  try {
    const c=await context(request);
    if (request.headers.get('origin')!==new URL(request.url).origin) throw new HttpError(403,'元の画面からお試しください。');
    if (request.headers.get('content-type')?.split(';')[0].trim()!=='application/json') throw new HttpError(400,'資料の入力内容を確認してください。');
    if (!request.body) throw new HttpError(400,'資料名を入力してください。');
    const reader=request.body.getReader(); let body=''; let total=0;
    const timeout=AbortSignal.timeout(5000);
    const cancel=()=>{void reader.cancel().catch(()=>undefined);};
    timeout.addEventListener('abort',cancel,{once:true});
    const decoder=new TextDecoder();
    try {
      while(true){
        const {done,value}=await reader.read();
        if(timeout.aborted) throw new HttpError(408,'もう一度お試しください。');
        if(done)break;
        total+=value.length;
        if(total>4096){cancel();throw new HttpError(413,'入力内容を短くしてください。');}
        body+=decoder.decode(value,{stream:true});
      }
      body+=decoder.decode();
    }finally{timeout.removeEventListener('abort',cancel);reader.releaseLock();}
    let input: Record<string,unknown>;
    try { input=JSON.parse(body); } catch { throw new HttpError(400,'資料の入力内容を確認してください。'); }
    if (!input || typeof input!=='object' || typeof input.courseId!=='string' || !isAssetUuid(input.courseId)
      || typeof input.title!=='string' || !input.title.trim() || input.title.trim().length>160
      || typeof input.requiresActive!=='boolean' || typeof input.isPublished!=='boolean') throw new HttpError(400,'資料の入力内容を確認してください。');
    const course=await c.user.from('academy_courses').select('id,headquarters_id').eq('id',input.courseId).maybeSingle();
    if(course.error||!course.data)throw new HttpError(403,'保存先の講座を確認してください。');
    // Existing material RLS + trial guard + owner-only publication rule still execute.
    const result=await c.user.from('academy_materials').insert({
      headquarters_id:course.data.headquarters_id,course_id:course.data.id,user_id:c.userId,
      kind:'pdf',title:input.title.trim(),url:null,delivery_mode:'private_file',
      requires_active:input.requiresActive,is_published:input.isPublished
    }).select('id,title,course_id,requires_active,is_published').single();
    if(result.error||!result.data)throw new HttpError(403,'資料を作成できません。編集権限と契約状態をご確認ください。');
    const m=result.data;
    return json({material:{id:m.id,courseId:m.course_id,title:m.title,requiresActive:m.requires_active,isPublished:m.is_published,deliveryMode:'private_file',url:null}},201);
  } catch(error) { return json({error:error instanceof HttpError?error.message:'資料を作成できませんでした。'},error instanceof HttpError?error.status:503); }
}
