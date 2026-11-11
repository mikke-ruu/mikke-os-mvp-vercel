import {invitationMail,PARTICIPATION_PARAGRAPHS,NOT_VISIBLE_NOTE} from './mail-layout.mjs';
export const TEMPLATE_VERSION='2026-11-01-v2';
export function invitationContent({name,sender,project,email,role,url}){
 if(!['client_user','worker'].includes(role))throw new Error('Unsupported invitation role');
 const link=new URL(url);if(link.origin!=='https://app.mikke-os.com'||!/^\/invitations\/team-works\/[0-9a-f-]{36}$/i.test(link.pathname))throw new Error('Invalid invitation URL');
 const recipient=typeof name==='string'?name.trim():'';
 const partner=role==='worker';
 const subject='【Team Works】'+project+'へのご招待';
 const paragraphs=[...(recipient?[recipient+'様']:[]),sender+'から、Team Worksのプロジェクトへのご招待が届いています。','参加先： '+project+'\n参加方法： '+(partner?'パートナーとして参加':'クライアントとして参加'),partner?'Team Worksでは、担当する予定や業務の確認、作業の報告、関係者との情報共有などができます。':'Team Worksでは、プロジェクトの予定や進行状況の確認、担当者との連絡、情報共有などができます。',...PARTICIPATION_PARAGRAPHS,'招待を確認する',NOT_VISIBLE_NOTE,'ご不明な点は、招待元の担当者へお問い合わせください。'];
 return invitationMail({subject,paragraphs,url});
}
