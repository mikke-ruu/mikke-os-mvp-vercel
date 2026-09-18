import {supabase} from '@/lib/supabase/client';

export type ReaderProfile={id:string;name:string;icon:string;avatar:string;bio:string;destination:'none'|'profile'|'media';href?:string|null};
export type ReaderComment={id:string;replyTo:string|null;rootId:string|null;body:string;status:'pending'|'visible'|'hidden'|'deleted';closed:boolean;held:boolean;createdAt:string;author:ReaderProfile;mine:boolean;owner:boolean;thanks:number;thanked:boolean};
export type SocialBoard={following:boolean;owner:boolean;signedIn:boolean;mode:'review'|'open'|'closed';saved:boolean;favorite:boolean;blocked:boolean;comments:ReaderComment[]};
export type ReaderArticle={id:string;kind?:'saved'|'favorite';title:string;href:string;site:string};
export type ReaderHome={profile:ReaderProfile;notifyReplies:boolean;articles:ReaderArticle[];following:{id:string;name:string;href:string}[];feed:ReaderArticle[];notices:{id:string;read:boolean;name:string;href:string}[]};

/** Hold the caller's identity across a request, including A → B → A transitions. */
export async function mediaSocialRpc<T>(name:string,args:Record<string,unknown>,subject?:string|null):Promise<T>{
 let changed=false;
 const {data:watch}=supabase.auth.onAuthStateChange((event,session)=>{
   if(!['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED'].includes(event)||(session?.user&&!session.user.is_anonymous?session.user.id:null)!==(subject??null))changed=true;
 });
 try{
   if(subject){const {data,error}=await supabase.auth.getUser();if(error||!data.user||data.user.is_anonymous||data.user.id!==subject||changed)throw Error('ログインし直してください。');}
   const {data,error}=await supabase.rpc(name,args);
   if(changed)throw Error('アカウントが変わりました。ページを開き直してください。');
   if(subject){const current=await supabase.auth.getUser();if(current.error||current.data.user?.id!==subject||changed)throw Error('アカウントが変わりました。ページを開き直してください。');}
   if(error)throw Error(error.message.includes('MEDIA_RATE_LIMIT')?'少し待ってからもう一度お試しください。':error.message.includes('MEDIA_COMMENTS_CLOSED')?'現在コメントを受け付けていません。':'保存または読み込みに失敗しました。もう一度お試しください。');
   return data as T;
 }finally{watch.subscription.unsubscribe();}
}
export async function readerAvatar(file:File):Promise<string>{
 if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>15*1024*1024)throw Error('15MB以下のJPG・PNG・WebPを選んでください。');
 const bitmap=await createImageBitmap(file);
 try{const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const context=canvas.getContext('2d');if(!context)throw Error('画像を読み込めませんでした。');const size=Math.min(bitmap.width,bitmap.height);context.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,128,128);return canvas.toDataURL('image/webp',.8);}finally{bitmap.close();}
}
