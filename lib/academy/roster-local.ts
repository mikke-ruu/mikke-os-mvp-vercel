import {supabase} from '@/lib/supabase/client';
export type RosterCertification={courseId:string;certifiedAt:string|null;renewalDue:string|null};
export type RosterEntry={id:string;full_name:string;instructor_number:string;certifications:RosterCertification[];version:number;request_id:string|null;confirmed_at:string|null;registered_at:string|null;withdrawn_at:string|null;linked_profile_id:string|null;contact_email?:string|null;email_invitation_pending?:boolean;target_handle?:string};
export async function rosterAction<T>(p_action:string,args:Record<string,unknown>={}):Promise<T>{
 const {data,error}=await supabase.rpc('academy_roster_action',{p_action,...args}).abortSignal(AbortSignal.timeout(30000));
 if(error){if(error.code==='PGRST202'||error.code==='42883')throw Error('講師名簿の準備中です。mikke IDをお持ちの先生は講師一覧から登録できます。');const messages:Record<string,string>={roster_invalid_action:'この名簿機能は準備中です。既存の講師登録は講師一覧から引き続き利用できます。',roster_email_required:'本人が受け取る連絡先メールアドレスを保存してください。',roster_invalid_email:'メールアドレスの形式を確認してください。',roster_certification_required:'認定講座と認定日を入力してください。',roster_number_required:'同じ先生を重複登録しないよう講師番号を設定してください。',roster_link_pending:'本人の連携確認後に正式登録してください。',roster_formal_locked:'正式登録後は認定講座の追加から変更してください。',roster_not_registered:'登録状態を確認してください。',roster_use_instructor_withdrawal:'連携済みの先生は講師一覧から登録を解除してください。',academy_instructor_reinstatement_required:'登録解除済みです。再登録について本部へ確認してください。',roster_name_required:'氏名を入力してください。',roster_existing_number:'この講師番号は既存の講師登録で使われています。講師一覧を確認してください。',roster_invalid_course:'認定講座を選び直してください。',roster_duplicate_course:'同じ講座が重複しています。',roster_profile_required:'mikke IDが見つかりません。本人が登録したIDを確認してください。',roster_stale:'保存状態が変わっています。再読み込みして確認してください。',roster_link_locked:'確認待ちの依頼を取り消してから編集してください。',roster_already_linked:'この本人との連携は確認済みです。名簿を確認してください。',roster_link_unavailable:'この確認依頼を開けません。対象のmikke IDと有効期限を確認してください。',roster_forbidden:'この名簿を操作する権限がありません。'};throw Error(error.code==='23505'?'同じ講師番号または本人がすでに名簿にあります。':messages[error.message]??'処理結果を確認できませんでした。再読み込みして保存状態を確認してください。');}return data as T;
}

export type InstructorInvitation={name:string;number:string;headquartersName:string;confirmed:boolean;registered:boolean};
export async function instructorEmailInvitation(token:string,confirm=false):Promise<InstructorInvitation>{
 const {data,error}=await supabase.rpc('academy_instructor_email_invitation',{p_token:token,p_confirm:confirm}).abortSignal(AbortSignal.timeout(30000));
 if(error)throw Error(error.message==='academy_instructor_reinstatement_required'?'登録解除済みの認定情報があります。再登録について本部へ確認してください。':error.message==='roster_already_linked'?'このアカウントはすでに別の講師名簿と連携しています。本部へ確認してください。':'この案内を開けません。案内が届いたメールアドレスでログインし、メール確認を済ませてください。有効期限が切れた場合は本部に再発行を依頼してください。');
 return data as InstructorInvitation;
}
