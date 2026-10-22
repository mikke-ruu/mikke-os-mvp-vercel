import {SalesPresentationSection} from './SalesPagePresentation';
import styles from './sales-page-presentation.module.css';
export function SalesApplicationFlow({paymentMethods,materialsOnly=false,arranged=false}:{paymentMethods:readonly string[];materialsOnly?:boolean;arranged?:boolean}){
 const end=materialsOnly?'教材で学ぶ':'受講';
 const flows=paymentMethods.flatMap(method=>method==='bank'?[{title:'銀行振込',steps:['お申し込み','振込案内に沿ってお支払い','本部で入金確認',end]}]:method==='external'?[{title:'外部決済サービス',steps:['お申し込み','決済ページでお支払い','本部で入金確認',end]}]:method==='onsite'?[{title:'当日のお支払い',steps:['お申し込み','当日会場でお支払い',end]}]:[]);
 if(!flows.length)return null;
 return <SalesPresentationSection heading="お申し込みから受講までの流れ">{flows.map(flow=><div className={styles.flow} key={flow.title}><h3>{flow.title}</h3><ol>{flow.steps.map((step,i)=><li key={step}><span>{i+1}</span>{step}</li>)}</ol></div>)}{arranged&&<p className={styles.flowNote}>日程はお申し込み後にご相談のうえ決定します。</p>}</SalesPresentationSection>;
}
