'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase/client';
export type LocalReviewChoice={id:string;name:string;mappings:{id:string;rooms:{id:string;name:string}[]}[]};
export type LocalReviewState={card:boolean;community:boolean;choices:LocalReviewChoice[]};
export async function localReview(hq:string,change?:{card?:boolean;community?:boolean}):Promise<LocalReviewState|null>{
 const {data}=await supabase.auth.getSession();if(!data.session)return null;
 const r=await fetch('/api/academy2/local-review'+(change?'':`?headquartersId=${encodeURIComponent(hq)}`),{method:change?'POST':'GET',cache:'no-store',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},...(change?{body:JSON.stringify({headquartersId:hq,...change})}:{})});
 if(r.status===404)return null;if(!r.ok)throw new Error('ローカル確認状態を取得できませんでした。');return r.json();
}
export function useLocalReviewVersion(){const [version,setVersion]=useState(0);useEffect(()=>{const update=()=>setVersion(v=>v+1);window.addEventListener('academy-local-review-change',update);return()=>window.removeEventListener('academy-local-review-change',update);},[]);return version;}
