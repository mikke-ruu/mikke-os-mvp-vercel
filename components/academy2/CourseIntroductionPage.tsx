'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {getPublicCourseIntroduction,getCourseIntroductionPreview,safeAcademyReturnHref,type CourseIntroduction} from '@/lib/academy2/course-introduction';
import {CoursePhotoGallery} from './CoursePhotoGallery';
import styles from './course-introduction.module.css';
function Writing({body}:{body:string}){
 return <>{body.split(/\n\s*\n/).filter(part=>part.trim()).map((part,i)=>{const lines=part.split('\n');return lines.every(line=>/^\s*[-・●]\s*\S/.test(line))?<ul key={i}>{lines.map((line,j)=><li key={j}>{line.replace(/^\s*[-・●]\s*/,'')}</li>)}</ul>:<p key={i}>{part}</p>;})}</>;
}
export function CourseIntroductionPage({id}:{id:string}){
 const search=useSearchParams();const previewHq=search.get('preview_hq');const back=safeAcademyReturnHref(search.get('return'));
 const backLabel=back?.split('?')[0]===`/academy/h/${previewHq}/manage/create`?'作成画面へ戻る':'販売ページへ戻る';
 const [course,setCourse]=useState<CourseIntroduction|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setLoading(true);setError('');void(async()=>{try{let result:CourseIntroduction|null;
  if(previewHq)result=await getCourseIntroductionPreview(previewHq,id);
  else result=await getPublicCourseIntroduction(id);
  if(live)setCourse(result);
 }catch(cause){if(live)setError(cause instanceof Error?cause.message:'講座を読み込めませんでした。');}finally{if(live)setLoading(false);}})();return()=>{live=false;};},[id,previewHq,retry]);
 if(loading)return <main className={styles.message} role="status">講座を読み込み中…</main>;
 if(error)return <main className={styles.message} role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>もう一度読み込む</button>{back&&<p><Link href={back}>{backLabel}</Link></p>}</main>;
 if(!course)return <main className={styles.message}>この講座の公開情報は見つかりませんでした。{back&&<p><Link href={back}>{backLabel}</Link></p>}</main>;
 const items=course.physical_items;
 return <main className={styles.page}>{previewHq&&<p className={styles.notice}>管理者プレビュー</p>}<article className={styles.article}><header className={styles.hero} data-has-image={course.images.length>0}><div>{back&&<Link className={styles.back} href={back}>← {backLabel}</Link>}<h1>{course.name}</h1>{course.subtitle?.trim()&&<p className={styles.subtitle}>{course.subtitle}</p>}</div><CoursePhotoGallery images={course.images} name={course.name}/></header><div className={styles.details}>{[["この講座で学べること",course.description],["こんな方におすすめ",course.target_audience],["所要時間",course.duration_text]].map(([title,body])=>body?.trim()?<section className={styles.section} key={title}><h2>{title}</h2><Writing body={body}/></section>:null)}{items?.enabled&&<section className={styles.section}><h2>含まれるもの</h2>{items.name&&<h3>{items.name}</h3>}{items.contents&&<Writing body={items.contents}/>}</section>}</div></article></main>;
}
