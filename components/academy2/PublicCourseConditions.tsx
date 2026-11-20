import styles from './public-course-page.module.css';
export function PublicCourseConditions({legalHref,fees,deadline}:{legalHref:string;fees?:string;deadline?:string}){
 return <section className={styles.conditions} aria-label="お支払い・その他のご案内"><h2>お支払い・その他のご案内</h2>{deadline&&<div><h3>お支払い期限</h3><p>{deadline}</p></div>}{fees&&<div><h3>受講料以外の費用</h3><p>{fees}</p></div>}<nav aria-label="受講条件を読む"><a href={legalHref+'#cancellation'}>キャンセル・返金について</a><a href={legalHref+'#terms'}>利用規約</a></nav></section>;
}
