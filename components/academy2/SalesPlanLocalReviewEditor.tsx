'use client';
import {useState} from 'react';
import {SalesPlanDraftEditor,type SalesPlanEditorApi} from './SalesPlanDraftEditor';
import type {Academy2Course} from '@/lib/academy2/courses';
import type {CourseShippingRow} from '@/lib/academy2/plan-review';
import type {SalesPlanDraft,SalesPlanDraftConfiguration} from '@/lib/academy2/sales-plan-drafts';
import type {PlanPublicationNoticeApi} from './PlanPublicationNotice';

/** Memory persistence for the actual editor controls, never a transport/Auth substitute. */
export function createSalesPlanLocalReviewStore({headquartersId,courses,initialDraft,shipping}:{headquartersId:string;courses:Academy2Course[];initialDraft:SalesPlanDraft;shipping?:CourseShippingRow[]}){
 let access:{months:number|null}={months:null};let bankReader:(()=>Promise<string>)|undefined;let saved=structuredClone(initialDraft),catalog=structuredClone(courses),failWrite=false,failReadback=false;
 const materialRows=structuredClone(shipping??courses.map(course=>({course_id:course.id,revision:1,configuration:{enabled:false,name:'',contents:'',shipping:false,handover:false}})));
 const requireHq=(hq:string)=>{if(hq!==headquartersId)throw new Error('別の本部のデータは取得できません。');};
 const api:SalesPlanEditorApi={getAccess:()=>structuredClone(access),saveAccess:value=>{access=structuredClone(value);},getBankNote:async()=>bankReader?bankReader():'振込先は未登録です。',
  load:async(hq,id)=>{requireHq(hq);if(failReadback){failReadback=false;throw new Error('確認用の再取得失敗です。');}if(id!==saved.id)throw new Error('販売プランを確認できません。');return structuredClone(saved);},
  listCourses:async(hq)=>{requireHq(hq);return structuredClone(catalog);},
  readShipping:async(hq,ids)=>{requireHq(hq);return ids.map(id=>{const row=materialRows.find(value=>value.course_id===id);if(!row)throw new Error('材料・教材の設定がありません。');return structuredClone(row);});},
  save:async(hq,id,expected,configuration)=>{requireHq(hq);if(failWrite){failWrite=false;throw new Error('確認用の保存失敗です。入力は残っています。');}if(saved.id!==id||saved.revision!==expected)throw Object.assign(new Error('保存済みの内容が変更されています。再取得してください。'),{code:'PT409'});
   if(configuration.course_ids.some(courseId=>!catalog.some(course=>course.id===courseId)))throw new Error('選んだ講座を確認できません。');
   saved={...saved,revision:expected+1,configuration:structuredClone(configuration),course_snapshot:configuration.course_ids.map(courseId=>({course_id:courseId,title:catalog.find(course=>course.id===courseId)!.name})),reference_price_snapshot:configuration.course_ids.map(courseId=>({course_id:courseId,amount:catalog.find(course=>course.id===courseId)!.reference_price,source:'academy2_course_settings' as const,source_revision:catalog.find(course=>course.id===courseId)!.reference_revision})),sale_price_snapshot:{currency:'JPY',purchase_mode:configuration.purchase_mode,price:configuration.price,stage_prices:structuredClone(configuration.stage_prices)},updated_at:new Date().toISOString()};return structuredClone(saved);
  },
 };
 return {api,setBankReader:(read:()=>Promise<string>)=>{bankReader=read;},seedTerms:(terms:{body:string;version:string})=>{saved={...saved,configuration:{...saved.configuration,terms:structuredClone(terms)}};},seedCourse:(course:Academy2Course)=>{saved={...saved,configuration:{...saved.configuration,title:course.name,description:course.description??'',course_ids:[course.id],price:course.reference_price},course_snapshot:[{course_id:course.id,title:course.name}]};},snapshot:()=>structuredClone(saved),setCourses:(value:Academy2Course[])=>{catalog=structuredClone(value);},failNextSave:()=>{failWrite=true;},failNextRead:()=>{failReadback=true;}};
}
export type SalesPlanLocalReviewStore=ReturnType<typeof createSalesPlanLocalReviewStore>;
const initialConfiguration=(course:Academy2Course):SalesPlanDraftConfiguration=>({title:course.name,description:course.description??'',kind:'単品講座',course_ids:[course.id],price:course.reference_price,purchase_mode:'all',stage_prices:{},study_style:'instructor',allowed_methods:['online'],materials:{enabled:false},payment_methods:['bank'],terms:{version:'review-v1',body:'ローカルの画面確認用です。実際の申込規約ではありません。'},after:{skill_certification:false,commercial_license:false,instructor_license:false,record_completion:true}});
export function SalesPlanLocalReviewEditor({bankRevision,headquartersId,course,initialDraft,store:providedStore,publicationNoticeApi,onEditorStateChange,onSaved,onContinue,onBack,onCourseLink,onOpenSettings}:{bankRevision?:number;headquartersId:string;course:Academy2Course;initialDraft?:SalesPlanDraft;store?:SalesPlanLocalReviewStore;publicationNoticeApi?:PlanPublicationNoticeApi;onEditorStateChange?:(value:{dirty:boolean;busy:boolean;saved:boolean})=>void;onSaved?:(draft:SalesPlanDraft)=>void;onContinue:(draft:SalesPlanDraft)=>void;onBack?:()=>void;onCourseLink?:(courseId:string)=>void;onOpenSettings?:()=>void}){
 const [ownStore]=useState(()=>{const configuration=initialConfiguration(course);const stamp=new Date().toISOString();return createSalesPlanLocalReviewStore({headquartersId,courses:[course],initialDraft:initialDraft??{id:'33333333-3333-4333-8333-333333333333',headquarters_id:headquartersId,revision:1,status:'draft',configuration,course_snapshot:[{course_id:course.id,title:course.name}],reference_price_snapshot:[],sale_price_snapshot:{currency:'JPY',purchase_mode:'all',price:configuration.price,stage_prices:{}},publication_hold:true,hold_reasons:[],created_at:stamp,updated_at:stamp}});});
 const store=providedStore??ownStore;
 return <section><SalesPlanDraftEditor bankRevision={bankRevision} headquartersId={headquartersId} draftId={store.snapshot().id} api={store.api} reviewOnly publicationNoticeApi={publicationNoticeApi} onEditorStateChange={onEditorStateChange} onBack={onBack} onCourseLink={onCourseLink} onOpenSettings={onOpenSettings} onSaved={onSaved} onPageAction={async(action,draft)=>{onSaved?.(draft);onContinue(draft);}}/></section>;
}
