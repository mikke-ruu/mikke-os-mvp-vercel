import type {CommonCreationApi} from '@/components/academy2/CommonCreation';
import type {CommonCourseState} from './common-creation';
import type {SalesPlanLocalReviewStore} from '@/components/academy2/SalesPlanLocalReviewEditor';
import type {HeadquartersSetupApi} from './headquarters-setup-api';
import type {HomepageEditorApi} from '@/components/academy2/HeadquartersHomepageEditor';
import type {Academy2Course} from './courses';
export function commonCreationReviewApi(hq:string,plans:SalesPlanLocalReviewStore,setup:HeadquartersSetupApi,homepage:HomepageEditorApi,onCourse:(value:NonNullable<CommonCourseState['document']>)=>void):CommonCreationApi{
 const documents=new Map<string,CommonCourseState>();
 const check=(id:string)=>{if(id!==hq)throw Error('別の本部のデータには接続しません。');};
 const catalog=()=>[...documents.values()].flatMap(state=>state.document?[structuredClone(state.document.course)]:[]);
 const shipping=(ids:string[])=>ids.map(id=>{const row=documents.get(id)?.shipping;if(!row)throw Error('講座の保存内容を確認してください。');return structuredClone(row);});
 const api:CommonCreationApi={getAccess:plans.api.getAccess,saveAccess:plans.api.saveAccess,
 listAcademy2Courses:async id=>{check(id);return catalog();},listSalesPlanDrafts:async id=>{check(id);return [];},
 loadCommonCourse:async(id,course)=>{check(id);const row=documents.get(course);if(!row)throw Error('講座を確認できませんでした。');return structuredClone(row);},
 getSalesPlanDraft:plans.api.load,getHeadquartersSettings:setup.getSettings,getHomepagePreparation:homepage.preparation,
 getAcademy2Event:async()=>{throw Error('この確認版では開催の取得には接続しません。');},listAcademy2Events:async()=>[],
 readCourseShipping:async(id,ids)=>{check(id);return shipping(ids);},
 getAcademy2Management:async(id,kind,target)=>{check(id);return {id:target,revision:1,source_version:'local',state:'active',archived:false,can_delete:false,delete_reason:'local review',allowed_actions:[]};},
 saveCommonCourse:async(id,previous,value)=>{check(id);if(!value.name.trim())throw Error('講座名を入力してください。');const courseId=previous.document?.course.id??crypto.randomUUID(),stamp=new Date().toISOString();
 const document:NonNullable<CommonCourseState['document']>={course:{id:courseId,headquarters_id:hq,user_id:'local-review',code:'LOCAL',name:value.name,description:value.description,subtitle:value.subtitle??'',duration_text:value.durationText,main_image_url:value.images[0]??'',marketing:{...(previous.document?.course.marketing??{}),images:[...value.images]},reference_price:value.referencePrice,reference_revision:(previous.reference?.revision??0)+1,lesson_count:0,material_count:0,created_at:previous.document?.course.created_at??stamp,updated_at:stamp},settings:{showIntroduction:true,sampleName:'',targetAudience:value.targetAudience},materials:{courseId,headquartersId:hq,revision:(previous.document?.materials.revision??0)+1,blocks:previous.document?.materials.blocks??[],curriculum:[],source:'academy2_draft',legacyUpdatedAt:null,deliveryChanged:false}};
 const state:CommonCourseState={...previous,document,reference:{course_id:courseId,headquarters_id:hq,reference_price:value.referencePrice,all_courses_eligible:false,revision:(previous.reference?.revision??0)+1,updated_at:stamp},shipping:{course_id:courseId,revision:(previous.shipping?.revision??0)+1,configuration:{...value.physicalItems,version:2,shipping:false,handover:false}}};documents.set(courseId,structuredClone(state));onCourse(structuredClone(document));plans.setCourses(catalog());return {status:'saved',state:structuredClone(documents.get(courseId)!),completed:['講座情報','参考価格','物品設定']};},
 saveCommonPlan:async(id,_plan,_expected,config)=>{check(id);const old=plans.snapshot();const settings=await setup.getSettings(id);const terms=settings.documents.find(doc=>doc.kind==='application');const items=shipping(config.course_ids);const next={...config,kit:{enabled:items.some(row=>row.configuration?.enabled),methods:[] as ('shipping'|'venue_handover')[]},terms:{body:config.terms?.body||terms?.body||'',version:config.terms?.version||crypto.randomUUID()}};const saved=await plans.api.save(id,old.id,old.revision,next);const verified=await plans.api.load(id,saved.id);if(verified.revision!==saved.revision)throw Error('保存結果を確認できませんでした。');return verified;}
 };return api;
}
