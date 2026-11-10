import {invitationMail,PARTICIPATION_PARAGRAPHS,NOT_VISIBLE_NOTE} from './mail-layout.mjs';
export function invitationContent({appLabel,title,sender,roleLabel,url,name}){
 const link=new URL(url);if(link.origin!=='https://app.mikke-os.com'||!/^\/invitations\/(academy|team-works)\/[0-9a-f-]{36}$/i.test(link.pathname))throw new Error('Invalid invitation URL');
 const recipient=typeof name==='string'?name.trim():'';
 const academy=appLabel==='Academy';
 const subject=academy?'【Academy】'+sender+'からご招待が届いています':'【'+appLabel+'】'+title+'へのご招待';
 const description=academy?'Academyでは、講座の運営や受講に関する情報を管理できます。':'Team Worksでは、プロジェクトの予定や情報、メンバーを管理できます。';
 const paragraphs=[...(recipient?[recipient+'様']:[]),sender+'から、'+appLabel+'へのご招待が届いています。','参加先： '+title+'\n役割： '+roleLabel,description,...PARTICIPATION_PARAGRAPHS,'招待を確認する',NOT_VISIBLE_NOTE,...(academy?[]:['ご不明な点は、招待元の担当者へお問い合わせください。'])];
 return invitationMail({subject,paragraphs,url});
}
