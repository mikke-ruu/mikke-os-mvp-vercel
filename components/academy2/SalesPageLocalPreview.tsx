'use client';
import {useEffect,useState} from 'react';
import {PublishedSalesPageContent} from './PublishedInformationPage';
import type {PublishedSalesPage} from '@/lib/academy2/plan-publication';
/** Development-only preview uses the public renderer, with no DB or persistent storage. */
export function openSalesPageLocalPreview(page:PublishedSalesPage){
 if(process.env.NODE_ENV!=='development'||!('BroadcastChannel' in window))throw Error('別画面のプレビューを開けませんでした。');
 const token=crypto.randomUUID(),url=new URL(window.location.href);url.searchParams.set('salesPreview',token);url.searchParams.set('previewHq',page.headquarters_id);
 const channel=new BroadcastChannel('academy-local-sales-'+token);const snapshot=structuredClone(page);let target:Window|null=null;
 channel.onmessage=event=>{if(event.data?.kind==='request'&&event.data.headquartersId===snapshot.headquarters_id)channel.postMessage({kind:'snapshot',page:snapshot});};
 target=window.open(url.href,'_blank');if(!target){channel.close();throw Error('プレビューを開けませんでした。ブラウザでポップアップを許可してから押してください。');}target.opener=null;
 const timer=setInterval(()=>{if(!target||target.closed){clearInterval(timer);channel.close();}},2000);
}
export function SalesPageLocalPreview({token,headquartersId}:{token:string;headquartersId:string}){
 const [page,setPage]=useState<PublishedSalesPage|null>(null),[connected,setConnected]=useState(true);
 useEffect(()=>{if(!/^[a-f0-9-]{36}$/i.test(token)||!('BroadcastChannel' in window)){setConnected(false);return;}const channel=new BroadcastChannel('academy-local-sales-'+token);let latest=Date.now();channel.onmessage=event=>{const value=event.data;if(value?.kind==='snapshot'&&value.page?.headquarters_id===headquartersId){latest=Date.now();setPage(value.page);setConnected(true);}};const request=()=>{channel.postMessage({kind:'request',headquartersId});if(Date.now()-latest>15000){setConnected(false);setPage(null);}};request();const timer=setInterval(request,2000);return()=>{clearInterval(timer);channel.close();};},[token,headquartersId]);
 return <><aside style={{padding:'10px 16px',fontSize:13,background:'#f0f6f2',color:'#365246'}}>販売ページのプレビューです。一般公開や申込受付は行いません。<button type="button" onClick={()=>window.close()} style={{marginLeft:16,textDecoration:'underline'}}>編集画面へ戻る（このタブを閉じる）</button></aside>{page&&connected?<PublishedSalesPageContent page={page}/>:<p role="status">{connected?'確認するページを読み込んでいます…':'編集画面との接続が切れました。元の画面からプレビューを開き直してください。'}</p>}</>;
}
