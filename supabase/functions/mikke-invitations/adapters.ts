import {invitationContent} from '../_shared/mikke-invitations/content.mjs';
import {invitationContent as teamWorksContent} from '../_shared/mikke-invitations/team-works-content.mjs';
import {digest,normalizeEmail} from '../_shared/mikke-invitations/core.mjs';
const roles:Record<string,string>={administrator:'本部運営担当',learning_operator:'受講運営担当',course_editor:'講座編集担当',manager:'管理者',worker:'担当メンバー',client_user:'クライアント'};
async function one(query:any){const {data,error}=await query.maybeSingle();if(error)throw new Error('招待情報を確認できませんでした。');return data;}
export function academyAdapter(caller:any){return {
 async load(id:string){const {data,error}=await caller.rpc('academy2_email_invitation_context',{p_invitation_id:id});if(error||!data)throw new Error('招待情報を確認できませんでした。');return data;},
 async authorizeSender(invite:any){if(!invite.canManage)throw new Error('招待メールの確認・送信は本部の所有者が行います。');},
 content(invite:any,url:string){return invitationContent({...invite,appLabel:'Academy',url});},
 async accept(invite:any){const {error}=await caller.rpc('academy2_respond_email_staff_invitation',{p_invitation_id:invite.id,p_response:'accepted'});if(error)throw new Error('参加結果を確認できませんでした。状態を再確認してください。');}
};}
export function teamWorksAdapter(admin:any,caller:any){return {
 async load(id:string,user:any){
  const invitation=await one(admin.from('team_works_member_invites').select('id,organization_id,project_id,email,role,status,expires_at,accepted_by_user_id').eq('id',id));if(!invitation)return null;
  const organization=await one(admin.from('team_works_organizations').select('id,name,status,owner_user_id').eq('id',invitation.organization_id));
  const project=invitation.project_id?await one(admin.from('team_works_projects').select('id,title,status,organization_id').eq('id',invitation.project_id).eq('organization_id',invitation.organization_id)):null;
  const directory=['client_user','worker'].includes(invitation.role)?await one(admin.from(invitation.role==='client_user'?'team_works_clients':'team_works_partners').select('display_name').eq('organization_id',invitation.organization_id).eq('email',invitation.email).limit(1)):null;
  const membership=await one(admin.from('team_works_organization_members').select('id').eq('organization_id',invitation.organization_id).eq('user_id',user.id).eq('status','active').eq('role',invitation.role).eq('invite_id',id));
  return {id,projectId:invitation.project_id,recipientName:directory?.display_name||'',email:invitation.email,title:project?.title??organization?.name,sender:organization?.name,role:invitation.role,roleLabel:roles[invitation.role],status:invitation.status,expiresAt:invitation.expires_at,active:!!organization&&organization.status==='active'&&!!project&&project.status==='active'&&!!roles[invitation.role],recipientActive:!!membership&&invitation.accepted_by_user_id===user.id,destination:invitation.role==='client_user'?'/apps/team-works/portal/client':invitation.role==='worker'?'/apps/team-works/portal/worker':'/apps/team-works/projects',organizationId:invitation.organization_id,ownerId:organization?.owner_user_id};
 },
 async previousDelivery(invite:any){
  const key=await digest(`${invite.projectId}/${invite.role}/${normalizeEmail(invite.email)}`);
  const {data,error}=await admin.rpc('mikke_invitation_previous_delivery',{p_delivery_key:key});
  if(error)throw new Error('以前の送信記録を確認できませんでした。');
  return data;
 },
 async authorizeSender(invite:any,user:any){const manager=await one(admin.from('team_works_organization_members').select('id').eq('organization_id',invite.organizationId).eq('user_id',user.id).eq('status','active').in('role',['owner','manager']).limit(1));if(invite.ownerId!==user.id&&!manager)throw new Error('この本部の管理者だけが招待メールを送信できます。');},
 content(invite:any,url:string){
  if(['client_user','worker'].includes(invite.role))return teamWorksContent({name:invite.recipientName,sender:invite.sender,project:invite.title,email:invite.email,role:invite.role,url});
  return invitationContent({...invite,appLabel:'Team Works',url});
 },
 async accept(invite:any,user:any){
  // RLS and the existing acceptance trigger remain authoritative. Never insert using the service role.
  const profile=await one(caller.from('profiles').select('display_name').eq('user_id',user.id));
  const {error}=await caller.from('team_works_organization_members').insert({organization_id:invite.organizationId,user_id:user.id,source_local_id:'invite:'+invite.id,display_name:profile?.display_name||'メンバー',role:invite.role,status:'active',invite_id:invite.id});
  if(error)throw new Error('参加結果を確認できませんでした。状態を再確認してください。');
 }
};}
