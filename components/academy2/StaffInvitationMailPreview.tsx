'use client';

import styles from './headquarters-settings.module.css';

/** Approved invitation copy for local review. No registration or delivery occurs here. */
export function StaffInvitationMailPreview({headquartersName,roleName}:{headquartersName:string;roleName:string}) {
 return <details className={styles.invitationPreview}>
  <summary>招待メールの文面を見る</summary>
  <div className={styles.mailSample}>
   <p className={styles.help}>選んだ役割での文面です。招待URLは招待ごとに入ります。このプレビューからメールは送信されません。</p>
   <h3>件名</h3>
   <p>【Academy】{headquartersName}からご招待が届いています</p>
   <h3>本文</h3>
   <p>{headquartersName}から、Academyへのご招待が届いています。</p>
   <p>参加先：{headquartersName}<br/>役割：{roleName}</p>
   <p>Academyでは、講座の運営や受講に関する情報を管理できます。</p>
   <h3>参加するには</h3>
   <p>下の「招待を確認する」から、招待内容をご確認ください。</p>
   <p>mikkeOSのアカウントをお持ちの方は、招待されたメールアドレスでログインし、初めての方は同じメールアドレスで新規登録してください。</p>
   <p>メールアドレスの確認が必要な場合は、確認後に招待画面へお戻りください。</p>
   <p>招待内容を確認し、参加を承諾すると利用できるようになります。</p>
   <span className={styles.sampleMailButton}>招待を確認する</span>
   <p className={styles.help}>※招待が表示されない場合は、招待されたメールアドレスでログインしているかご確認ください。</p>
  </div>
 </details>;
}
