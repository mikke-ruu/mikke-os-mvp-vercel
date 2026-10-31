'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';

/** A preview-entry hint only. It never grants access or accepts a redirect URL. */
export function useAcademyPublicReturn(context:string|undefined){
 const [enabled,setEnabled]=useState(false);
 useEffect(()=>{setEnabled(new URLSearchParams(window.location.search).get('from')==='academy');},[context]);
 return enabled;
}
export function AcademyPublicReturnLink({enabled,headquartersId}:{enabled:boolean;headquartersId:string}){
 if(!enabled)return null;
 return <nav aria-label="Academyへ戻る" className="border-b border-[var(--mikke-line)] bg-white px-5 py-3"><Link href={`/academy/h/${encodeURIComponent(headquartersId)}/manage`} className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--mikke-accent)] underline">← Academyの管理画面へ戻る</Link></nav>;
}
