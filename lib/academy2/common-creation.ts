import { getCourseEditor, saveCourseEditor, type CourseEditorDocument, type CourseEditorSave } from './course-editor';
import { getAcademy2CourseSettings, saveAcademy2CourseSettings, type Academy2CourseSettings } from './course-settings';
import { saveCoursePhysicalItems, type CoursePhysicalItems } from './course-physical-items';
import { readCourseShipping, deriveCourseKit, type CourseShippingRow } from './plan-review';
import { getSalesPlanDraft, saveSalesPlanDraft, type SalesPlanDraftConfiguration } from './sales-plan-drafts';
import type { Academy2Course } from './courses';
import { courseImages } from '@/lib/academy/course-marketing';
import { commonTermsForSave } from './common-terms';

export type CommonCourseValues = {
  name:string; description:string; targetAudience:string; durationText:string;
  referencePrice:number|null; physicalItems:CoursePhysicalItems; images:string[];
  subtitle?:string; materialChoice:'now'|'later'|'none';
};
export type CommonCourseState = {
  document:CourseEditorDocument|null; reference:Academy2CourseSettings|null;
  shipping:CourseShippingRow|null; requestId:string|null; requestKey:string|null;
  pendingBasic?:CourseEditorSave;
};
export function createEmptyCommonCourseState():CommonCourseState {
  return {document:null,reference:null,shipping:null,requestId:null,requestKey:null};
}
export async function loadCommonCourse(hq:string,id:string):Promise<CommonCourseState> {
  const [document,reference,shipping]=await Promise.all([getCourseEditor(hq,id),getAcademy2CourseSettings(hq,id),readCourseShipping(hq,[id])]);
  return {...createEmptyCommonCourseState(),document,reference,shipping:shipping[0]};
}
export function commonCourseValues(state:CommonCourseState):CommonCourseValues {
  const doc=state.document;
  return {name:doc?.course.name??'',description:doc?.course.description??'',targetAudience:doc?.settings.targetAudience??'',durationText:doc?.course.duration_text??'',referencePrice:state.reference?.reference_price??null,physicalItems:state.shipping?.configuration??{enabled:false,name:'',contents:''},images:doc?courseImages(doc.course.marketing??{},doc.course.main_image_url).slice(0,3):[],materialChoice:doc?.materials.blocks.length?'now':'later'};
}
/** Transactions remain independent. A partial outcome never claims atomic success. */
export async function saveCommonCourse(hq:string,previous:CommonCourseState,values:CommonCourseValues) {
  const state={...previous}; const completed:string[]=[]; let failed='講座情報';let acknowledgedBasic=false;
  try {
    if(!values.name.trim())throw new Error('講座名を入力してください。');
    if(values.referencePrice!==null&&(!Number.isSafeInteger(values.referencePrice)||values.referencePrice<0))throw new Error('参考価格は0円以上の整数で入力してください。');
    if(values.physicalItems.enabled&&!values.physicalItems.name.trim())throw new Error('渡すものの名称を入力してください。');
    const existing=state.document;
    const oldImages=existing?courseImages(existing.course.marketing??{},existing.course.main_image_url).slice(0,3):[];
    if(values.images.length>3||values.images.some(url=>!/^https?:\/\//i.test(url)))throw new Error('写真のURLを確認してください。');
    if(values.images.length>1&&JSON.stringify(values.images.slice(1))!==JSON.stringify(oldImages.slice(1)))throw new Error('追加写真の保存接続は準備中です。現在は代表写真を変更できます。');
    const input:Omit<CourseEditorSave,'requestId'>={courseId:existing?.course.id??null,expectedUpdatedAt:existing?.course.updated_at??null,materialRevision:existing?.materials.revision??0,legacyUpdatedAt:existing?.materials.legacyUpdatedAt??null,
      basic:{name:values.name,description:values.description,duration_text:values.durationText,subtitle:values.subtitle??existing?.course.subtitle??'',main_image_url:values.images[0]??'',...(existing?{code:existing.course.code}:{})},
      settings:{...(existing?.settings??{showIntroduction:true,sampleName:'',targetAudience:''}),targetAudience:values.targetAudience},blocks:existing?.materials.blocks??[]};
    const basicCurrent=existing?{name:existing.course.name,description:existing.course.description??'',duration_text:existing.course.duration_text??'',subtitle:existing.course.subtitle??'',main_image_url:existing.course.main_image_url??'',code:existing.course.code}:null;
    const needsBasic=!existing||JSON.stringify(input.basic)!==JSON.stringify(basicCurrent)||input.settings.targetAudience!==existing.settings.targetAudience;
    if(needsBasic||state.pendingBasic){
      const key=JSON.stringify(input);
      // A newly saved course receives a server code; that is not an input edit.
      const retryBasic=state.pendingBasic?{...input.basic,code:state.pendingBasic.basic.code}:input.basic;
      if(state.pendingBasic&&(JSON.stringify(state.pendingBasic.basic)!==JSON.stringify(retryBasic)||state.pendingBasic.settings.targetAudience!==input.settings.targetAudience||state.pendingBasic.settings.showIntroduction!==input.settings.showIntroduction||state.pendingBasic.settings.sampleName!==input.settings.sampleName))throw new Error('前回の保存結果を確認してから入力を変更してください。入力内容は残っています。');
      if(!state.pendingBasic&&(!state.requestId||state.requestKey!==key)){state.requestId=crypto.randomUUID();state.requestKey=key;}
      const payload:CourseEditorSave=state.pendingBasic??{...input,requestId:state.requestId!};state.pendingBasic=payload;
      const saved=await saveCourseEditor(hq,payload);
      acknowledgedBasic=true;
      // Keep the acknowledged document even if read-back fails; retry is the same request.
      state.document=saved;
      const verified=await getCourseEditor(hq,saved.course.id);
      if(verified.course.updated_at!==saved.course.updated_at||verified.materials.revision!==saved.materials.revision)throw new Error('講座の保存後に別の変更がありました。最新の内容を確認してください。');
      state.document=verified;state.pendingBasic=undefined;state.requestId=null;state.requestKey=null;
      completed.push('講座情報');
    }
    const id=state.document!.course.id;
    failed='参考価格';
    const reference=state.reference??await getAcademy2CourseSettings(hq,id);
    if(reference.reference_price!==values.referencePrice){
      const saved=await saveAcademy2CourseSettings(hq,id,reference.revision,values.referencePrice,reference.all_courses_eligible);
      state.reference=saved;
    }else state.reference=reference;
    const verifiedReference=await getAcademy2CourseSettings(hq,id);
    if(verifiedReference.revision!==state.reference.revision||verifiedReference.reference_price!==values.referencePrice)throw new Error('参考価格の保存結果を確認できませんでした。');
    state.reference=verifiedReference;
    state.document={...state.document!,course:{...state.document!.course,reference_price:verifiedReference.reference_price,reference_revision:verifiedReference.revision}};
    completed.push('参考価格');
    failed='物品設定';
    const shipping=state.shipping??(await readCourseShipping(hq,[id]))[0];state.shipping=shipping;
    const desired=values.physicalItems;
    if(!shipping.configuration||shipping.configuration.enabled!==desired.enabled||shipping.configuration.name!==desired.name||shipping.configuration.contents!==desired.contents){
      try{state.shipping=await saveCoursePhysicalItems(hq,id,shipping.revision,desired);}catch(error){const saved=(error as {savedRow?:CourseShippingRow}).savedRow;if(saved)state.shipping=saved;throw error;}
    }else{const [verified]=await readCourseShipping(hq,[id]);if(verified.revision!==shipping.revision)throw new Error('物品設定が更新されています。最新の内容を確認してください。');state.shipping=verified;}
    completed.push('物品設定');
    return {status:'saved' as const,state,completed};
  }catch(cause){return {status:completed.length||acknowledgedBasic?'partial' as const:'failed' as const,state,completed,failed,error:cause instanceof Error?cause:new Error('保存結果を確認できませんでした。')};}
}

export function createCommonPlanConfiguration(courses:Academy2Course[],kind:SalesPlanDraftConfiguration['kind']=courses.length>1?'コース':'単品講座'):SalesPlanDraftConfiguration {
  return {title:courses.length===1?courses[0].name:'',description:courses.length===1?courses[0].subtitle??'':'',kind,course_ids:courses.map(course=>course.id),price:courses.length&&courses.every(course=>course.reference_price!==null)?courses.reduce((sum,course)=>sum+(course.reference_price??0),0):null,purchase_mode:'all',stage_prices:{},study_style:'instructor',allowed_methods:['in_person','online'],materials:{enabled:false},payment_methods:['bank'],after:{record_completion:true,skill_certification:false,commercial_license:false,instructor_license:false},terms:{version:'',body:''},show_course_introductions:true,application_form:{conditionalVersion:1,fields:[{id:'name',label:'お名前',type:'text',required:true},{id:'email',label:'メールアドレス',type:'email',required:true},{id:'phone',label:'電話番号',type:'tel',required:false},{id:'notes',label:'備考・質問',type:'textarea',required:false},{id:'terms',label:'申込規約への同意',type:'agreement',required:true}]}};
}
export type CommonPlanPatch=Partial<Pick<SalesPlanDraftConfiguration,'title'|'description'|'kind'|'course_ids'|'price'|'study_style'|'allowed_methods'|'payment_methods'|'external_payment_urls'|'external_payment_details'|'terms'>> & {materials?:Partial<NonNullable<SalesPlanDraftConfiguration['materials']>>};
/** Only fields exposed in this screen may change; detailed settings survive a round trip. */
export function patchCommonPlanConfiguration(current:SalesPlanDraftConfiguration,patch:CommonPlanPatch):SalesPlanDraftConfiguration {
  const allowed=new Set(['title','description','kind','course_ids','price','study_style','allowed_methods','payment_methods','external_payment_urls','external_payment_details','terms','materials']);
  if(Object.keys(patch).some(key=>!allowed.has(key)))throw new Error('詳細設定は販売プランの詳細編集で変更してください。');
  const {materials,...fields}=patch;
  return {...current,...fields,...(materials?{materials:{...(current.materials??{enabled:false}),...materials}}:{})};
}
export async function saveCommonPlan(hq:string,id:string,revision:number,configuration:SalesPlanDraftConfiguration) {
  const previous=revision>0?await getSalesPlanDraft(hq,id):null;
  if(previous&&previous.revision!==revision)throw new Error('販売プランが更新されています。保存済みの内容を確認してください。');
  const terms=await commonTermsForSave(configuration.terms,previous?.configuration.terms);
  const shipping=await readCourseShipping(hq,configuration.course_ids);
  if(shipping.some(row=>row.configuration?.enabled&&row.configuration.version!==2))throw new Error('旧物品設定は講座の詳細画面で確認してください。この画面では受け渡し条件を変更しません。');
  // Existing draft API derives its authoritative source snapshot; preserve old plan settings as before.
  const kit=deriveCourseKit(shipping);
  if(!kit)throw new Error('講座の物品設定を保存してから、販売プランを保存してください。');
  const saved=await saveSalesPlanDraft(hq,id,revision,{...configuration,terms,kit});
  try {
    const verified=await getSalesPlanDraft(hq,id);
    if(verified.revision!==saved.revision||JSON.stringify(verified.configuration)!==JSON.stringify(saved.configuration))throw new Error('販売プランの保存後の取得を確認できませんでした。入力内容は残っています。');
    return verified;
  }catch(cause){throw Object.assign(cause instanceof Error?cause:new Error('販売プランの保存後の取得を確認できませんでした。'),{savedDraft:saved});}
}
