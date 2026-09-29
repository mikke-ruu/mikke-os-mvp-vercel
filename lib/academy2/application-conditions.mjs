/** One condition evaluator for the saved draft, administrator preview and public intake.
 * Hidden answers never drive dependent questions and are omitted from submission. */
export const defaultApplicationFields = [
 {id:'name',label:'お名前',type:'text',required:true},{id:'email',label:'メールアドレス',type:'email',required:true},
 {id:'phone',label:'電話番号',type:'tel',required:false},{id:'notes',label:'備考・質問',type:'textarea',required:false},
 {id:'terms',label:'申込規約への同意',type:'agreement',required:true},
];
export function applicationContext(configuration={}, event=null, mode='headquarters') {
 const instructor=configuration.study_style!=='materials_only';
 const kit=configuration.kit;
 const delivery=event?.kitMethod ?? (kit?.methods?.length===1?kit.methods[0]:null);
 return {format:instructor?event?.format??null:null,schedule_mode:instructor?(mode==='instructor'?'arranged_after_application':event?.scheduleMode??null):null,
  kit_shipping:!!kit?.enabled&&kit.recipient!=='instructor'&&delivery==='shipping',certificate:!!configuration.after?.certificate,
  instructor_registration:configuration.after?.instructor_license===true,physical_certificate:!!configuration.after?.certificate&&configuration.after.certificate.delivery!=='digital',course_ids:configuration.course_ids??[]};
}
export function conditionMatches(condition, context, visibleAnswers={}) {
 if(!condition)return true;
 const {source,value,field_id}=condition;
 if(source==='answer')return Object.hasOwn(visibleAnswers,field_id)&&visibleAnswers[field_id]===value;
 if(source==='course')return context.course_ids.includes(value);
 if(source==='kit_shipping'||source==='certificate')return String(context[source])===value;
 return (source==='format'||source==='schedule_mode')&&context[source]===value;
}
export function visibleApplicationFields(fields,context,answers={}) {
 const visible=[],seen={};
 for(const field of fields??[]){if(conditionMatches(field.condition,context,seen)){visible.push(field);seen[field.id]=(answers[field.id]??'').trim();}}
 return visible;
}
export function automaticApplicationFields(context) {
 const fields=[];
 if(context.schedule_mode==='arranged_after_application')fields.push(
  {id:'preferred_date_1',label:'第1希望日',type:'date',required:true},
  {id:'preferred_time',label:'希望時間帯',type:'select',required:false,options:['指定なし','午前','午後','夕方以降']},
  {id:'preferred_date_2',label:'第2希望日',type:'date',required:false},{id:'preferred_date_3',label:'第3希望日',type:'date',required:false},
  {id:'preferred_date_note',label:'日程についての補足',type:'textarea',required:false});
 if(context.instructor_registration)fields.push({id:'instructor_path_notice',label:'講師活動には受講後の登録・契約・条件確認が必要です',type:'select',required:true,options:['確認しました']});
 if(context.certificate)fields.push({id:'certificate_name',label:'証書記載名',type:'text',required:true});
 if(context.kit_shipping||context.physical_certificate)fields.push({id:'shipping_address',label:'発送先（郵便番号・住所・宛名）',type:'textarea',required:true});
 return fields;
}
export function intakeFields(form,context,answers={}) {
 const fields=visibleApplicationFields(form?.fields??[],context,answers);
 // UI05: notes and agreement follow the automatically generated questions.
 return [...fields.filter(f=>f.id!=='notes'&&f.id!=='terms'),...(form?.conditionalVersion===1?automaticApplicationFields(context):[]),...fields.filter(f=>f.id==='notes'),...fields.filter(f=>f.id==='terms')];
}
export function projectApplicationAnswers(fields,answers={}) {
 return Object.fromEntries(fields.filter(f=>!['name','email','terms'].includes(f.id)).map(f=>[f.id,(answers[f.id]??'').trim()]));
}
export function applicationFormErrors(fields) {
 const errors=[],seen=new Map();
 if(fields.length>30)errors.push('質問は30項目以内にしてください。');
 for(const field of fields){
  if(!field.id||seen.has(field.id)||!field.label.trim())errors.push('質問文と項目IDを確認してください。');
  if(field.type==='select'&&(!field.options?.length||field.options.some(v=>!v.trim())||new Set(field.options).size!==field.options.length))errors.push('選択肢を重複のない内容で入力してください。');
  if(field.condition?.source==='answer'&&!seen.has(field.condition.field_id))errors.push('回答による条件は、この質問より前の質問を選んでください。');
  if(field.condition&&!field.condition.value?.trim())errors.push('質問を表示する条件を入力してください。');
  seen.set(field.id,field);
 }
 return [...new Set(errors)];
}
