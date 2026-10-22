'use client';
import Link from 'next/link';
import {courseImages,courseMarketing} from '@/lib/academy/course-marketing';
import {courseIntroductionHref} from '@/lib/academy2/course-introduction';
import type {AcademyCourseCardInfo} from '@/components/academy/AcademyCourseCard';
import {CoursePhotoGallery} from './CoursePhotoGallery';
import styles from './course-introduction.module.css';
export function SalesCourseCard({course,returnHref,previewHq,imageSide='left'}:{course:AcademyCourseCardInfo&{id:string};returnHref?:string;previewHq?:string;imageSide?:'left'|'right'}){
 const images=courseImages(courseMarketing(course.marketing??course.feature_settings?.marketing),course.main_image_url).slice(0,3);
 if(course.show_introduction===false)return null;
 return <article className={styles.card} data-has-image={images.length>0} data-image-side={imageSide}><CoursePhotoGallery images={images} name={course.name}/><div><h2>{course.name}</h2>{course.subtitle?.trim()&&<p>{course.subtitle}</p>}<Link href={courseIntroductionHref(course.id,returnHref,previewHq)} target={previewHq?'_blank':undefined} rel={previewHq?'noopener noreferrer':undefined}>講座の詳細を見る →</Link></div></article>;
}
