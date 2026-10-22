'use client';
import {Suspense} from 'react';
import {useSearchParams} from 'next/navigation';
import {safeCreationReturn} from '@/lib/academy2/creation-return';
function ReturnLink({headquartersId,canLeave}:{headquartersId:string;canLeave?:()=>boolean}){
 const query=useSearchParams(),back=safeCreationReturn(query.get('returnTo'),headquartersId);
 if(!back)return null;
 return <a href={back} className="inline-flex min-h-11 items-center rounded-lg border border-[#d9dedc] bg-white px-4 text-sm font-semibold text-[#4b535e]" onClick={event=>{if(canLeave&&!canLeave())event.preventDefault();}}>← 作成画面へ戻る</a>;
}

export function CreationReturnLink(props:{headquartersId:string;canLeave?:()=>boolean}){return <Suspense fallback={null}><ReturnLink {...props}/></Suspense>;}
