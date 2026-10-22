'use client';
import {useEffect,useState} from 'react';
import styles from './course-introduction.module.css';
export function CoursePhotoGallery({images,name,dots=false}:{images:readonly string[];name:string;dots?:boolean}){
 const photos=[...new Set(images.filter(url=>/^https?:\/\//i.test(url)))].slice(0,3);
 const [index,setIndex]=useState(0);const key=photos.join('\n');
 useEffect(()=>{setIndex(0);if(photos.length<2||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const timer=window.setInterval(()=>setIndex(value=>(value+1)%photos.length),7000);return()=>window.clearInterval(timer);},[key,photos.length]);
 if(!photos.length)return null;
 return <div className={styles.photos}><img src={photos[index%photos.length]} alt={`${name}${photos.length>1?` ${index%photos.length+1}枚目`:''}`}/>{photos.length>1&&<nav aria-label="講座写真" className={styles.photoControls}>{photos.map((url,i)=><button key={url} type="button" onClick={()=>setIndex(i)} aria-label={`${i+1}枚目の写真`} aria-pressed={index%photos.length===i}>{dots?'●':i+1}</button>)}</nav>}</div>;
}
