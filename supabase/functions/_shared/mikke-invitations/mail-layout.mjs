const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const PARTICIPATION_PARAGRAPHS=[
 '参加するには',
 '下の「招待を確認する」から、招待内容をご確認ください。',
 'mikkeOSのアカウントをお持ちの方は、招待されたメールアドレスでログインし、初めての方は同じメールアドレスで新規登録してください。',
 'メールアドレスの確認が必要な場合は、確認後に招待画面へお戻りください。',
 '招待内容を確認し、参加を承諾すると利用できるようになります。',
];
export const NOT_VISIBLE_NOTE='※招待が表示されない場合は、招待されたメールアドレスでログインしているかご確認ください。';
export function invitationMail({subject,paragraphs,url}){
 const cleanSubject=subject.replace(/[\r\n]/g,' ');
 const text=paragraphs.map(p=>p==='招待を確認する'?p+'\n'+url:p).join('\n\n');
 const body=paragraphs.map(p=>p==='招待を確認する'?'<p style="margin:24px 0"><a href="'+escape(url)+'" style="display:inline-block;background:#4452b2;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none">招待を確認する</a></p>':p==='参加するには'?'<h2 style="font-size:18px;margin:28px 0 12px">参加するには</h2>':'<p style="margin:0 0 18px;overflow-wrap:anywhere">'+escape(p).replaceAll('\n','<br>')+'</p>').join('');
 return {subject:cleanSubject,text,html:'<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f5f7f7;padding:16px"><main style="box-sizing:border-box;max-width:600px;margin:auto;background:white;padding:24px;border-radius:16px;font-family:Arial,sans-serif;font-size:16px;line-height:1.8;color:#263a32">'+body+'</main></body></html>'};
}
