import type {SalesPlanPublicationState} from '@/lib/academy2/sales-plan-catalog';
import {publicationSummary} from '@/lib/academy2/publication-navigation';
import styles from './publication-flow.module.css';
export function PublicationStatusCard({publication,reviewHref,disabled=false}:{publication:SalesPlanPublicationState|null;reviewHref:string;disabled?:boolean}){
 const summary=publicationSummary(publication);
 return <section className={styles.card} aria-label="販売ページの公開状態"><span className={styles.status}>{summary.label}</span><p>{summary.description}</p><div className={styles.actions}>{disabled?<button type="button" disabled className={styles.primary}>販売ページを確認・公開する</button>:<a className={styles.primary} href={reviewHref}>販売ページを確認・公開する</a>}{!disabled&&publication?.state==='published'&&publication.public_path&&<a className={styles.button} href={publication.public_path}>公開ページを見る</a>}</div>{disabled&&<p className={styles.small}>入力した変更を保存すると、確認へ進めます。</p>}</section>;
}
