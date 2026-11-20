'use client';
import type {ComponentType} from 'react';
import {AcademyImageUploader} from '@/components/academy/AcademyImageUploader';
import {resolvePlanCoverImage,type PlanCoverImage} from '@/lib/academy2/plan-cover-image';
import styles from './plan-cover-image.module.css';
export function PlanCoverImageField({value,courseIds,courses,onChange,ImagePicker=AcademyImageUploader}:{value?:PlanCoverImage;courseIds:string[];courses:{id:string;main_image_url?:string|null;image?:string|null}[];onChange:(value:PlanCoverImage)=>void;ImagePicker?:ComponentType<{compact?:boolean;currentUrl?:string;onUploaded:(url:string)=>void}>}){
 const selected=courseIds.map(id=>courses.find(c=>c.id===id)??{}),cover=resolvePlanCoverImage(value,selected);
 return <section className={styles.field} aria-label="販売プランの代表画像"><h3>販売プランの代表画像 <span>任意</span></h3><p>プラン全体を紹介する画像です。講座の写真は、それぞれの講座紹介に表示されます。</p>
 <p className={styles.note}>{cover.source==='course'?'選んだ講座の代表画像を使っています。別の画像に変更できます。':cover.source==='custom'?'この販売プラン専用の画像です。講座の写真は変わりません。':courseIds.length>1?'複数講座のプランでは、全体の雰囲気が伝わる画像を選べます。画像なしでも進めます。':'画像なしでも進めます。講座に写真があれば、その代表画像を使うこともできます。'}</p>
 <ImagePicker compact currentUrl={cover.url??undefined} onUploaded={url=>onChange(url?{mode:'custom',url}:{mode:'none'})}/>
 <div className={styles.actions}>{cover.url&&<button type="button" onClick={()=>onChange({mode:'none'})}>代表画像を外す</button>}{courseIds.length===1&&value?.mode&&value.mode!=='auto'&&<button type="button" onClick={()=>onChange({mode:'auto'})}>講座の代表画像を使う</button>}</div></section>;
}
