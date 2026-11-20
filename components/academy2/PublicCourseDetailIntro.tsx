import type {AcademyCourseCardInfo} from '@/components/academy/AcademyCourseCard';
import {courseImages,courseMarketing} from '@/lib/academy/course-marketing';
import {CoursePhotoGallery} from './CoursePhotoGallery';
import styles from './public-course-page.module.css';
export function PublicCourseDetailIntro({course,offeringTitle,imageSide}:{course:AcademyCourseCardInfo;offeringTitle:string;imageSide?:'left'|'right'}){
 const marketing=courseMarketing(course.marketing??course.feature_settings?.marketing),photos=courseImages(marketing,course.main_image_url);
 if(course.show_introduction===false)return null;
 return <article className={styles.introduction} data-has-image={photos.length>0} data-image-side={imageSide??marketing.imageSide??'left'}>{!!photos.length&&<div className={styles.introPhoto}><CoursePhotoGallery images={photos} name={course.name} crop/></div>}<div className={styles.introCopy}>{course.name!==offeringTitle&&<h2>{course.name}</h2>}{course.subtitle&&<p className={styles.lead}>{course.subtitle}</p>}{course.description&&<section><h3>この講座で学べること</h3><p>{course.description}</p></section>}{course.target_audience&&<section><h3>こんな方におすすめ</h3><p>{course.target_audience}</p></section>}{course.can_do_after&&<section><h3>受講後にできること</h3><p>{course.can_do_after}</p></section>}{!!marketing.curriculum?.length&&<section><h3>カリキュラム</h3><ol>{marketing.curriculum.filter(t=>t.trim()).map((t,i)=><li key={i}>{t}</li>)}</ol></section>}{course.duration_text&&<p className={styles.duration}>所要時間：{course.duration_text}</p>}{([['オンライン教材のご案内',course.material_contents],['認定条件',course.certification_conditions]] as const).map(([heading,body])=>body?.trim()?<section key={heading}><h3>{heading}</h3><p>{body}</p></section>:null)}</div></article>;
}
