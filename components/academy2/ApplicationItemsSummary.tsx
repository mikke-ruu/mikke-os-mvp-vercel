import type {SalesPlan} from '@/lib/academy2/sales-plan.mjs';
import type {ApplicationContext} from '@/lib/academy2/application-conditions.mjs';
import styles from './public-course-page.module.css';
type Course={id:string;physical_items?:{enabled?:boolean;name?:string;contents?:string}|null};
export function ApplicationItemsSummary({configuration,courses,context,eventSelected,deliveryMethod,applicationForm=true}:{configuration?:Partial<Pick<SalesPlan,'study_style'|'kit'|'after'|'course_ids'|'materials'>>;courses:Course[];context:ApplicationContext;eventSelected:boolean;deliveryMethod?:string|null;fees?:string;timing?:string;applicationForm?:boolean}){
 const kit=configuration?.kit,supplied=kit?.enabled===true;
 const items=supplied?courses.filter(c=>context.course_ids.includes(c.id)&&c.physical_items?.enabled).map(c=>c.physical_items!):[];
 const seen=new Set<string>();const unique=items.filter(item=>{const k=JSON.stringify([item.name,item.contents]);if(seen.has(k))return false;seen.add(k);return true;});
 if(!supplied&&!context.physical_certificate&&!configuration?.materials?.enabled)return null;
 const delivery=deliveryMethod??(kit?.methods?.length===1?kit.methods[0]:null);
 return <section className={styles.items} aria-label="教材・材料のご案内"><h2>教材・材料のご案内</h2>{supplied&&<>{unique.length?<div className={styles.itemsContents}><h3>教材・材料の内容</h3>{unique.map((item,i)=><p key={i}>{item.contents||item.name}</p>)}</div>:null}{delivery==='shipping'&&kit?.recipient!=='instructor'?<p className={styles.deliveryNote}>{applicationForm?'教材・材料をご自宅へ発送します。発送先をご入力ください。':'教材・材料をご自宅へ発送します。'}</p>:delivery==='venue_handover'?<p className={styles.deliveryNote}>教材・材料は当日、会場でお渡しします。</p>:kit?.recipient==='instructor'?<p className={styles.deliveryNote}>教材・材料は担当者が用意します。受け渡しについては担当者からご案内します。</p>:!applicationForm?null:eventSelected?<p className={styles.deliveryNote}>教材・材料のお渡しについては、担当者からご案内します。</p>:null}</>}{configuration?.materials?.enabled&&<p className={styles.deliveryNote}>動画・PDFなど、オンラインで見る教材があります。</p>}{context.physical_certificate&&<p className={styles.deliveryNote}>証書は郵送します。お申し込み画面で発送先をご入力ください。</p>}</section>;
}
