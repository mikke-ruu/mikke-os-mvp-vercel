const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const frontKeys=new Set(['name','tagline','front_message','hero_image_url','contact_email','front_blocks']);
export function matchesLegacyPaidTarget(scope,userId,headquartersId){return !!scope&&scope.enabled===true&&uuid.test(scope.headquartersId)&&uuid.test(scope.ownerUserId)&&scope.headquartersId===headquartersId&&scope.ownerUserId===userId;}
export function createLegacyPaidTargetAdapter(scope,deps){
 if(!scope?.enabled||!uuid.test(scope.headquartersId)||!uuid.test(scope.ownerUserId))throw Error('Academyの編集対象を確認できません。');
 let saving=false;
 async function read(){
  const user=await deps.getUser();
  if(!user||user.id!==scope.ownerUserId||user.is_anonymous===true)throw Error('この本部の所有者としてログインしてください。');
  const [hq,access]=await Promise.all([deps.getHeadquarters(scope.headquartersId,user.id),deps.getAccess(scope.headquartersId)]);
  // The existing RPC returns the paid access-window status, including internal_grant.
  // Provenance alone grants nothing: paid kind, writable flags and canonical owner remain required.
  const writableExistingPaid=access?.headquarters_id===hq?.id&&access?.access_kind==='paid'
   &&(access.status==='active'||access.status==='internal_grant')
   &&access.can_manage_drafts===true&&access.can_use_live_features===true;
  if(!hq||hq.id!==scope.headquartersId||hq.owner_user_id!==user.id||!writableExistingPaid)throw Error('この本部の利用状態を確認できません。');
  if(access.ends_at!==null&&access.ends_at!==undefined&&(!Number.isFinite(Date.parse(access.ends_at))||Date.parse(access.ends_at)<=deps.now()))throw Error('この本部の利用期間を確認してください。');
  return hq;
 }
 async function save(patch){
  if(saving)throw Error('保存中です。完了してから操作してください。');
  saving=true;try{
   await read();
   const row=await deps.updateProfile(scope.headquartersId,structuredClone(patch));
   if(!row||row.id!==scope.headquartersId||row.owner_user_id!==scope.ownerUserId||typeof row.updated_at!=='string'||!Number.isFinite(Date.parse(row.updated_at)))throw Error('保存結果を確認できません。再読み込みしてください。');
   return row;
  }finally{saving=false;}
 }
 return {read,async saveFront(patch){
  if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!frontKeys.has(k)))throw Error('ホームページの編集項目を確認してください。');
  if('front_blocks' in patch&&!Array.isArray(patch.front_blocks))throw Error('ページ内容を確認してください。');
  return save(patch);
 },async saveBankNote(note){if(typeof note!=='string'||note.length>4000)throw Error('振込案内は4,000文字以内で入力してください。');return save({default_payment_note:note});}};
}
