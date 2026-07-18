// mikke AI OFFICE — エージェント実行レイヤー。
// UIとAI実行部分を分離するための共通入口。
// 今回のMVPは mock のみ。将来 manual（人が対応）/ codex（Claude Code連携）/
// api（Claude API等の自動実行）をここに差し込む。

import type { AgentTaskInput, AgentTaskResult, ExecutionMode } from "./types";

/** 現在の実行モード。将来は設定画面や環境変数で切り替える想定 */
export const currentExecutionMode: ExecutionMode = "mock";

const mockMessages = [
  "承知しました。作業を開始します。",
  "内容を確認しました。順番に進めますね。",
  "受け取りました。完了したら確認待ちに回します。",
  "了解です。この案件、私にお任せください。"
];

async function executeMock(input: AgentTaskInput): Promise<AgentTaskResult> {
  // 実際の処理は行わず、AI社員が返事をした風のメッセージを返す
  await new Promise((resolve) => setTimeout(resolve, 400));
  const message = mockMessages[Math.floor(Math.random() * mockMessages.length)];
  return { ok: true, mode: "mock", message: `${input.employee.name}：${message}` };
}

/**
 * AI社員にタスクを実行させる共通関数。
 * 呼び出し側（UI）はモードを意識せず、この関数だけを使う。
 */
export async function executeAgentTask(input: AgentTaskInput): Promise<AgentTaskResult> {
  switch (currentExecutionMode) {
    case "mock":
      return executeMock(input);
    case "manual":
    case "codex":
    case "api":
      // TODO: 将来ここに各実行方式を実装する
      return { ok: false, mode: currentExecutionMode, message: "この実行モードは未実装です" };
  }
}
