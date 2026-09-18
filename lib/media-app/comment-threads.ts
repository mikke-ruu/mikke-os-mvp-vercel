// Domain rules shared by the local demonstration and a future authenticated repository.
export type CommentMode = "review" | "open" | "closed";
export type NoticeMode = "replies" | "off";
export type CommentActor = {id:string; name:string; icon?:string; avatar?:string};
export type ThreadComment = {id:string; articleId:string; rootId:string|null; replyTo:string|null; author:CommentActor; body:string; status:"pending"|"visible"|"hidden"|"deleted"; createdAt:string; closed:boolean; thanks:string[]};
export type CommentBoard = {version:1; mode:CommentMode; overrides:Record<string,CommentMode>; comments:ThreadComment[]; blocked:string[]; reports:{commentId:string;actorId:string}[]; preferences:Record<string,string>; notificationPreferences?:Record<string,NoticeMode>; notices:{id:string;commentId:string;recipient:string;read:boolean}[]};
export function emptyBoard():CommentBoard {return {version:1,mode:"review",overrides:{},comments:[],blocked:[],reports:[],preferences:{},notices:[]};}
export function modeFor(board:CommentBoard,articleId:string){return board.overrides[articleId]??board.mode;}
export function canSee(board:CommentBoard,c:ThreadComment,actorId:string,ownerId:string):boolean {
  if(c.status!=="visible"&&c.status!=="deleted"&&actorId!==ownerId&&actorId!==c.author.id)return false;
  if(c.rootId){const root=board.comments.find(item=>item.id===c.rootId);if(!root||!canSee(board,root,actorId,ownerId))return false;}
  return true;
}
function publishNotices(board:CommentBoard,c:ThreadComment,ownerId:string){
  const root=c.rootId??c.id;
  const recipients=new Set([ownerId,...board.comments.filter(x=>x.id===root||x.rootId===root).map(x=>x.author.id)]);
  const target=board.comments.find(x=>x.id===c.replyTo);
  for(const recipient of recipients){
    const mode=board.notificationPreferences?.[recipient]??"replies";
    if(recipient===c.author.id||mode==="off"||!canSee(board,c,recipient,ownerId))continue;
    if(recipient!==target?.author.id&&!(recipient===ownerId&&!c.rootId))continue;
    if(!board.notices.some(n=>n.commentId===c.id&&n.recipient===recipient))board.notices.push({id:c.id+":"+recipient,commentId:c.id,recipient,read:false});
  }
}
export type CommentCommand =
 | {type:"post";articleId:string;body:string;replyTo?:string}
 | {type:"mode";mode:CommentMode|"inherit";articleId?:string}
 | {type:"approve"|"hide"|"delete"|"thanks"|"close"|"report";id:string}
 | {type:"block";authorId:string}
 | {type:"unblock";authorId:string}
 | {type:"preference";mode:NoticeMode}
 | {type:"read"};
export function changeBoard(current:CommentBoard,actor:CommentActor,ownerId:string,command:CommentCommand):CommentBoard {
  if(!actor.id)throw Error("ログインしてください。");
  const b:CommentBoard=structuredClone(current);
  const owner=actor.id===ownerId;
  const requireOwner=()=>{if(!owner)throw Error("書き手だけが操作できます。");};
  if(command.type==="mode"){requireOwner();if(command.articleId){if(command.mode==="inherit")delete b.overrides[command.articleId];else b.overrides[command.articleId]=command.mode;}else if(command.mode!=="inherit")b.mode=command.mode;return b;}
  if(command.type==="block"||command.type==="unblock"){requireOwner();if(command.type==="unblock"){b.blocked=b.blocked.filter(id=>id!==command.authorId);return b;}if(command.authorId===ownerId)throw Error("自分をブロックできません。");if(!b.blocked.includes(command.authorId))b.blocked.push(command.authorId);return b;}
  if(command.type==="read"){b.notices.filter(n=>n.recipient===actor.id).forEach(n=>n.read=true);return b;}
  if(command.type==="preference"){b.notificationPreferences={...b.notificationPreferences,[actor.id]:command.mode};return b;}
  if(command.type==="post"){
    if(modeFor(b,command.articleId)==="closed")throw Error("コメントの受付を終了しています。");
    if(b.blocked.includes(actor.id))throw Error("このMediaには投稿できません。");
    const body=command.body.trim();if(!body||body.length>2000)throw Error("コメントは1〜2000文字で入力してください。");
    const target=command.replyTo?b.comments.find(c=>c.id===command.replyTo):undefined;
    if(command.replyTo&&(!target||target.articleId!==command.articleId||target.status!=="visible"||!canSee(b,target,actor.id,ownerId)))throw Error("返信先が見つかりません。");
    const root=target?b.comments.find(c=>c.id===(target.rootId??target.id)):undefined;
    if(root?.closed)throw Error("このスレッドの返信は終了しています。");
    const c:ThreadComment={id:crypto.randomUUID(),articleId:command.articleId,rootId:root?.id??null,replyTo:target?.id??null,author:{...actor},body,status:owner||modeFor(b,command.articleId)==="open"?"visible":"pending",createdAt:new Date().toISOString(),closed:false,thanks:[]};
    b.comments.push(c);if(c.status==="visible")publishNotices(b,c,ownerId);return b;
  }
  const c=b.comments.find(c=>c.id===command.id);
  if(!c||!canSee(b,c,actor.id,ownerId))throw Error("コメントが見つかりません。");
  switch(command.type){
    case "approve":requireOwner();if(c.status==="deleted")throw Error("削除済みです。");if(c.rootId&&b.comments.find(x=>x.id===c.rootId)?.status!=="visible")throw Error("先に元のコメントを公開してください。");c.status="visible";publishNotices(b,c,ownerId);break;
    case "hide":requireOwner();if(c.status!=="deleted")c.status="hidden";break;
    case "delete":if(c.author.id!==actor.id)throw Error("自分のコメントだけ削除できます。");c.status="deleted";c.body="";c.thanks=[];break;
    case "close":requireOwner();if(c.rootId)throw Error("元のコメントを選んでください。");c.closed=!c.closed;break;
    case "thanks":if(c.status!=="visible"||b.blocked.includes(actor.id))throw Error("このコメントには反応できません。");c.thanks=c.thanks.includes(actor.id)?c.thanks.filter(id=>id!==actor.id):[...c.thanks,actor.id];break;
    case "report":if(!b.reports.some(r=>r.commentId===c.id&&r.actorId===actor.id))b.reports.push({commentId:c.id,actorId:actor.id});break;
  }
  return b;
}
export function visibleNotices(board:CommentBoard,actorId:string,ownerId:string){return board.notices.filter(n=>n.recipient===actorId&&board.comments.some(c=>c.id===n.commentId&&c.status==="visible"&&canSee(board,c,actorId,ownerId)));}
