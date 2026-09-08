// Development simulation only. No persistence, API, payment or invitation delivery.
export const WEEK = 7 * 24 * 60 * 60 * 1000;
export const START = Date.parse("2026-09-07T01:00:00Z");
export type State = { now: number; first: number | null; published: boolean; agreed: boolean; owner: boolean; cancelled: boolean; paid: boolean; invitation: "none" | "pending" | "accepted" | "cancelled"; rooms: string[]; message: string };
export const initial: State = {now:START,first:null,published:false,agreed:false,owner:true,cancelled:false,paid:false,invitation:"none",rooms:[],message:""};
export type Action = {type:"agree";value:boolean} | {type:"owner";value:boolean} | {type:"publish"|"fail"|"draft"|"deadline"|"cancel"|"pay"|"invite"|"accept"|"revoke"|"reset"};
export function reduce(s:State,a:Action):State {
  const say=(message:string)=>({...s,message});
  switch(a.type){
    case "reset":return {...initial};
    case "agree":return {...s,agreed:a.value,message:""};
    case "owner":return {...s,owner:a.value,agreed:false,message:""};
    case "fail":return say("公開に失敗しました。新たな無料期間は開始していません。");
    case "publish":
      if(!s.owner)return say("本部責任者による確認が必要です。編集権限だけでは初公開できません。");
      if(s.cancelled)return say("有料移行を取り消しています。再開条件は別途確認が必要です。");
      if(s.first===null&&!s.agreed)return say("料金・無料終了日時・取消方法を確認してください。");
      return {...s,published:true,first:s.first??s.now,message:s.first===null?"初公開に成功しました。ここから7日間無料です（シミュレーション）。":"再公開しました。無料期間の起点は変わりません。"};
    case "draft":return {...s,published:false,message:"下書きに戻しました。利用契約と無料期間は継続します。解約ではありません。"};
    case "deadline":return s.first===null?say("先に初公開を試してください。"):{...s,now:s.first+WEEK,message:"無料終了日時ちょうどの状態です。課金は自動実行しません。"};
    case "cancel":
      if(!s.owner)return say("取消は本部責任者が行います。");
      if(s.first===null||s.paid||s.now>s.first+WEEK)return say("無料中の有料移行取消の対象ではありません。有料利用後の解約とは別です。");
      return {...s,cancelled:true,message:"期限内の取消を受け付けました。初回課金はありません。公開停止日時は未確定のため、この見本では変更しません。"};
    case "pay":
      if(s.first===null||s.now<s.first+WEEK)return say("まだ初回課金のタイミングではありません。");
      if(s.cancelled)return say("期限内に取消済みのため、課金しません。");
      return {...s,paid:true,message:"支払い成功を再現しました。実際の請求は行っていません。"};
    case "invite":
      if(!s.owner)return say("本部とCommunity両方の責任者だけが招待できます。");
      if(s.invitation!=="none")return say("既存の招待があります。履歴を上書きしません。");
      return {...s,invitation:"pending",rooms:["先生同士の相談室","講師向けのお知らせ"],message:"サンプルの先生への招待を作成しました。承諾前は参加できません。実送信はありません。"};
    case "accept":return s.invitation!=="pending"?say("承諾できる招待がありません。"):{...s,invitation:"accepted",message:"招待された先生本人の承諾を再現しました。案内した2つのRoomだけ参加できます。"};
    case "revoke":
      if(!s.owner)return say("招待の取消は本部とCommunity両方の責任者が行います。");
      return s.invitation!=="pending"?say("未承諾の招待だけ取り消せます。"):{...s,invitation:"cancelled",message:"招待を取り消しました。参加権限は付与していません。"};
  }
}
