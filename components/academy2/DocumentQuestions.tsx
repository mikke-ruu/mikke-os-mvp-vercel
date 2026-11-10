'use client';

import {documentQuestions} from '@/lib/academy2/setup-suggestions';
import styles from './headquarters-settings.module.css';

export function DocumentQuestions({body,answers,onChange,disabled}:{body:string;answers:Record<string,string>;onChange:(value:Record<string,string>)=>void;disabled:boolean}){
 const questions=documentQuestions(body);
 const missing=questions.filter(question=>!answers[question.token]?.trim());
 return <section aria-label="規約に必要な質問"><p className={styles.help}>編集用の例文です。実際の運用に合わせて確認・変更してから保存してください。保存済みの情報は引き継いでいます。</p>
  {questions.map((question,index)=><div className={`${styles.field} ${styles.questionField}`} key={question.token}>
   <label htmlFor={`document-answer-${index}`}>{question.label}</label>
   {question.examples.length>1&&<select aria-label={`${question.label} 選択肢`} value={question.examples.includes(answers[question.token])?answers[question.token]:''} disabled={disabled} onChange={event=>onChange({...answers,[question.token]:event.target.value})}><option value="">選択するか、下に入力してください</option>{question.examples.map(example=><option key={example} value={example}>{example}</option>)}</select>}
   <textarea id={`document-answer-${index}`} value={answers[question.token]??''} placeholder={question.examples[0]??question.label} aria-describedby={!answers[question.token]?.trim()?`document-answer-help-${index}`:undefined} disabled={disabled} rows={4} maxLength={5000} onChange={event=>onChange({...answers,[question.token]:event.target.value})}/>
   {!answers[question.token]?.trim()&&<p id={`document-answer-help-${index}`} className={styles.help}>この項目を入力してください。</p>}
  </div>)}
  {questions.length===0&&<p className={styles.note}>未回答の項目はありません。プレビューで内容を確認できます。</p>}
  {missing.length>0&&<p className={styles.help}>未入力が{missing.length}項目あります。</p>}
 </section>;
}
