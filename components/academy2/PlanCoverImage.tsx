import {resolvePlanCoverImage} from '@/lib/academy2/plan-cover-image';
export function PlanCoverImage({value,title}:{value:unknown;title:string}){
 const cover=resolvePlanCoverImage(value,[]);
 return cover.source==='custom'&&cover.url?<figure data-plan-cover style={{margin:'24px 0',overflow:'hidden',borderRadius:14}}><img src={cover.url} alt={title+'の代表画像'} style={{display:'block',width:'100%',maxHeight:480,objectFit:'cover'}}/></figure>:null;
}
