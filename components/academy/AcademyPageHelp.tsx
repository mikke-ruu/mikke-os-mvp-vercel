"use client";

import { AcademyHelp } from "./AcademyHelp";

const topics = [
  ["/applications", "申込・受注管理の使い方", "本部で直接受けた申込と、講師経由の申込を切り替えて確認します。入金・発送などの状態は、実際に確認できた事実に合わせて更新してください。ここで入金済みにする操作は、決済そのものを実行する操作ではありません。"],
  ["/instructors", "講師管理の使い方", "一緒に講座を教える人の登録情報や認定状況を確認する場所です。講座を一つ作るために、最初から講師を全員登録する必要はありません。サービスページから届いた申込は「申込」で確認します。"],
  ["/classes", "開催日程の使い方", "講座は教える内容、開催日程は実際に行う一回ごとの予定です。まず講座を登録し、その講座をいつ・誰が教えるか、参加者は誰かをここで管理します。"],
  ["/front", "ホームページ編集とは", "教室・Academy全体を紹介するページを整える場所です。講座情報と教材は「講座」、販売価格と申込ページは「サービス」で編集します。まず一講座を作りたい場合は、教室全体のページを先に完成させる必要はありません。"],
  ["/settings", "本部設定とは", "Academyを運営する教室全体の設定です。Academyの利用料金と、受講者が講座に払う受講料は別です。受講者向けの販売価格と支払方法は「サービス」で設定します。"]
];

export function AcademyPageHelp({ pathname }: { pathname: string }) {
  const topic = topics.find(([route]) => pathname.includes(route));
  return topic ? <AcademyHelp key={topic[0]} title={topic[1]}>{topic[2]}</AcademyHelp> : null;
}
