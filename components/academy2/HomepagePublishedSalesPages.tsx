'use client';
import {useEffect,useState} from 'react';
import {listPublishedSalesPages,type PublishedSalesPageSummary} from '@/lib/academy2/plan-publication';
/** Only public page summaries are read. Draft pages and private course data are never requested. */
export function HomepagePublishedSalesPages({headquartersId,suppliedPages,heading="講座のご案内"}:{headquartersId:string;suppliedPages?:PublishedSalesPageSummary[];heading?:string}){
 const [result,setResult]=useState<{hq:string;pages:PublishedSalesPageSummary[];error:boolean}|null>(null),[retry,setRetry]=useState(0);
 useEffect(()=>{if(suppliedPages!==undefined){setResult({hq:headquartersId,pages:suppliedPages,error:false});return;}let active=true;setResult(null);listPublishedSalesPages(headquartersId).then(pages=>{if(active)setResult({hq:headquartersId,pages,error:false});}).catch(()=>{if(active)setResult({hq:headquartersId,pages:[],error:true});});return()=>{active=false;};},[headquartersId,retry,suppliedPages]);
 if(result?.hq===headquartersId&&!result.error&&!result.pages.length)return null;
 return <section className="my-8 min-w-0 space-y-4" aria-label="公開中の講座のご案内">{heading&&<h2 className="text-xl font-semibold">{heading}</h2>}{!result||result.hq!==headquartersId?<p role="status">講座を読み込んでいます…</p>:result.error?<div role="status"><p>講座のページを読み込めませんでした。</p><button type="button" className="min-h-11 underline" onClick={()=>setRetry(value=>value+1)}>再読み込み</button></div>:<ul className="grid min-w-0 gap-5 md:grid-cols-2">{result.pages.map(page=><li key={page.plan_id} className="overflow-hidden rounded-2xl border border-[#e2e7e4]">{page.main_image_url&&<img src={page.main_image_url} alt="" className="h-48 w-full object-cover"/>}<div className="p-5"><h3 className="break-words text-lg font-semibold">{page.title}</h3><p className="mt-3">{page.price.toLocaleString('ja-JP')}円</p><a className="mt-3 inline-flex min-h-11 items-center underline" href={page.public_path}>講座の内容を見る</a></div></li>)}</ul>}</section>;
}
