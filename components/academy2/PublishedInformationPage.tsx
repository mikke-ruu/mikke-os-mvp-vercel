'use client';
import {useEffect,useState} from 'react';
import {PublicOffering} from '@/components/academy/PublicOffering';
import {CoursePagePresentation} from './CoursePagePresentation';
import {PublicSiteFrame} from './PublicSiteFrame';
import {getPublishedSalesPage,type PublishedSalesPage} from '@/lib/academy2/plan-publication';
import type {Academy2Course} from '@/lib/academy2/courses';
import {SalesPlanPageContent} from './SalesPageContent';

/** Only the public RPC's explicit projection enters this view. No private editor reads. */
export function PublishedInformationPage({planId}:{planId:string}){
 const [page,setPage]=useState<PublishedSalesPage|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setPage(null);setLoading(true);setError('');getPublishedSalesPage(planId).then(v=>{if(live)setPage(v);}).catch(()=>{if(live)setError('ページを取得できませんでした。');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[planId,retry]);
 if(loading)return <main><p role="status">ページを読み込んでいます…</p></main>;
 if(error)return <main><p role="alert">{error}</p><button onClick={()=>setRetry(v=>v+1)}>再読み込み</button></main>;
 if(!page)return <main><h1>このページは現在公開されていません</h1></main>;
 // The public RPC exposes this URL only when the exact published plan/page
 // revisions match an independently valid intake. Never join private drafts.
 if(page.accepting&&page.application_path)return <PublicOffering id={page.application_path.slice('/academy/o/'.length)}/>;
 return <PublicSiteFrame headquartersId={page.headquarters_id}><PublishedSalesPageContent page={page}/></PublicSiteFrame>;
}

export function PublishedSalesPageContent({page}:{page:PublishedSalesPage}){
 const courses:Academy2Course[]=page.courses.map(c=>({...c,headquarters_id:page.headquarters_id,user_id:'',code:'',created_at:'',updated_at:'',reference_price:null,reference_revision:0,lesson_count:null}));
 return <CoursePagePresentation informationOnly coverImage={page.cover_image} title={page.title} blocks={page.blocks} price={page.price} events={[]} methods={[]} courses={courses} legalHref="" accepting={false}><SalesPlanPageContent offeringTitle={page.title} blocks={page.blocks} courses={courses} returnHref={`/academy/page/${page.plan_id}`}/></CoursePagePresentation>;
}
