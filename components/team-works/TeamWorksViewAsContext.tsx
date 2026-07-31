"use client";

import { createContext, useContext, type ReactNode } from "react";

// O-3(2026-08-01)「〜として表示」モード。
// 本部staffがクライアント/スタッフのポータルを本物の画面のまま確認するための文脈。
//
// 経緯: 「機能とポータルの設定」タブの埋め込みプレビューは pointer-events-none で
// 操作を止めていたため、コマをクリックして開く作業窓に永久に辿り着けなかった
// (あゆみ「作業窓についても見たいです。ここを充実させないと、見せるべきもの、
// 見せてはいけないものがこちらで確認できません」)。タブ切り替えとコマのクリックは
// 通しつつ、書き込みだけを止める必要があるため pointer-events では足りない。
//
// この文脈が非nullの間、各ポータルは
//   - 保存・送信・提出などの操作ボタンを disabled にする
//   - 上部に「〇〇さんとして表示中」のバナーを出す
// という約束で動く。RLSは変更していない(staffは元々組織の全データを読める)ので、
// これは「うっかり本人のふりをして書き込む」ことを防ぐための画面側の歯止め。
export type TeamWorksViewAs = {
  organizationMemberId: string;
  displayName: string | null;
  role: "client" | "worker";
};

const TeamWorksViewAsContext = createContext<TeamWorksViewAs | null>(null);

export function TeamWorksViewAsProvider({ value, children }: { value: TeamWorksViewAs | null; children: ReactNode }) {
  return <TeamWorksViewAsContext.Provider value={value}>{children}</TeamWorksViewAsContext.Provider>;
}

// 通常のログイン表示では null を返す(=既存の挙動のまま)。
export function useViewAs(): TeamWorksViewAs | null {
  return useContext(TeamWorksViewAsContext);
}

// 操作ボタンの disabled に混ぜて使う。
export function useIsViewAs(): boolean {
  return useContext(TeamWorksViewAsContext) !== null;
}

export function TeamWorksViewAsBanner() {
  const viewAs = useViewAs();
  if (!viewAs) return null;
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--mikke-accent)] bg-[var(--mikke-primary-soft)] px-4 py-3"
    >
      <span className="text-sm font-extrabold text-[var(--mikke-primary)]">
        {viewAs.displayName ?? "対象者"} さんとして表示中
      </span>
      <span className="text-xs font-semibold text-[var(--mikke-muted)]">
        本部の確認用です。この画面から保存・送信はできません。
      </span>
    </div>
  );
}
