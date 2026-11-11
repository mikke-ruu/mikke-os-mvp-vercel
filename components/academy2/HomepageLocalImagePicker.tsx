'use client';
import {useRef,useState} from 'react';
import type {HomepageImagePicker} from './HeadquartersHomepageEditor';
/** For isolated local review only. Never authenticates, uploads, or calls a production service. */
export const HomepageLocalImagePicker:HomepageImagePicker=function HomepageLocalImagePicker({currentUrl,onUploaded}){
 const [error,setError]=useState(''),reader=useRef<FileReader|null>(null);
 if(process.env.NODE_ENV==='production')return <p>この画像選択はローカル確認専用です。</p>;
 return <div>{currentUrl&&<img src={currentUrl} alt="選択中の画像" style={{maxWidth:'100%',maxHeight:180,objectFit:'contain'}}/>}<label style={{display:'inline-flex',alignItems:'center',minHeight:44,padding:'8px 14px',border:'1px solid #dce3df',borderRadius:9,cursor:'pointer',background:'#fff',fontSize:16}}><span>この端末の画像を選ぶ</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{position:'absolute',width:1,height:1,overflow:'hidden',clipPath:'inset(50%)'}} onChange={event=>{const file=event.target.files?.[0];if(!file)return;if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>5*1024*1024){setError('5MB以内のJPEG・PNG・WebP・GIF画像を選んでください。');return;}setError('');reader.current?.abort();const next=new FileReader();reader.current=next;next.onload=()=>{if(typeof next.result==='string')onUploaded(next.result);};next.onerror=()=>setError('画像を読み込めませんでした。');next.readAsDataURL(file);event.target.value='';}}/></label><p style={{fontSize:14,color:'#4b535e'}}>この確認画面内だけで使います。アップロードはしません。</p>{error&&<p role="alert">{error}</p>}</div>;
};
