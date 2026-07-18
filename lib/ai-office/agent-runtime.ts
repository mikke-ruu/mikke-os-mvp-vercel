// mikke AI OFFICE — エージェント実行レイヤー。
// UIとAI実行部分を分離するための共通入口。実行ポイントはこのファイルに集約する。
//
// モードの意味:
//   mock   … ダミー返答のみ（デモ用）
//   manual … 人間が外部で作業し、成果物を手動登録するモード
//   codex  … 将来Claude Code接続を担当。今回は疑似実行（実際の外部実行はしない）
//   api    … 将来のOpenAI API / 他AI接続用の枠。今回は未接続stub
//
// 本物のClaude Code CLI / SDK接続を入れるときは runCodexTask() の中身だけを
// 差し替えればよい（呼び出し側はCodexTaskRequestを渡すだけ）。

import type {
  AgentTaskInput,
  AgentTaskResult,
  ArtifactType,
  CodexTaskRequest,
  ExecutionMode,
  JobType
} from "./types";

/** 新規案件のデフォルト実行モード */
export const defaultExecutionMode: ExecutionMode = "mock";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- mock ----

const mockMessages = [
  "承知しました。作業を開始します。",
  "内容を確認しました。順番に進めますね。",
  "受け取りました。完了したら確認待ちに回します。",
  "了解です。この案件、私にお任せください。"
];

async function executeMock(input: AgentTaskInput): Promise<AgentTaskResult> {
  await wait(400);
  const message = mockMessages[Math.floor(Math.random() * mockMessages.length)];
  return { ok: true, mode: "mock", message: `${input.employee.name}：${message}` };
}

// ---- codex（疑似実行） ----

/** 仕事の種類 → 期待する成果物タイプ */
export const expectedArtifactTypeByJobType: Record<JobType, ArtifactType> = {
  course: "text",
  editing: "text",
  design: "layout",
  coding: "html",
  research: "notes",
  pr: "text",
  support: "notes",
  other: "notes"
};

const codexResultByJobType: Record<JobType, { title: string; content: string }> = {
  course: { title: "講座テキスト構成案", content: "講座第1章の文章構成を作成しました。導入 → 具体例 → 練習 → まとめの4部構成です。" },
  editing: { title: "編集済みテキスト案", content: "文章構成を整理し、読みやすい流れに編集しました。見出しと段落を再構成しています。" },
  design: { title: "デザインレイアウト案", content: "デザインレイアウト案を作成しました。ヘッダー・メインビジュアル・3カラム構成の下書きです。" },
  coding: { title: "実装プレビューメモ", content: "実装プレビュー用メモを作成しました。コンポーネント分割と実装手順の下書きです。" },
  research: { title: "調査メモ", content: "関連情報を調査し、要点をメモにまとめました。" },
  pr: { title: "広報文案", content: "告知用の文章案を作成しました。SNS向けの短文バージョン付きです。" },
  support: { title: "対応メモ", content: "お問い合わせ対応の返信案をまとめました。" },
  other: { title: "作業メモ", content: "依頼内容を整理し、作業メモを作成しました。" }
};

/**
 * Claude Code接続の実行ポイント（1箇所に集約）。
 * 今回は疑似実行：数秒待って、仕事の種類に応じたダミー成果物を返す。
 * 将来ここにClaude Code CLI / SDK / runner連携を実装する。
 */
export async function runCodexTask(request: CodexTaskRequest): Promise<AgentTaskResult> {
  // TODO(将来): ここで request.workDirectory を使いClaude Codeへジョブを渡す
  await wait(1500);
  const result = codexResultByJobType[request.jobType];
  return {
    ok: true,
    mode: "codex",
    message: `${request.agentName}：${result.content}`,
    artifact: {
      type: request.expectedArtifactType,
      title: result.title,
      content: `${result.content}\n\n【実行指示】${request.instruction || "（指示なし）"}`
    }
  };
}

// ---- manual / api ----

async function executeManual(input: AgentTaskInput): Promise<AgentTaskResult> {
  await wait(200);
  return {
    ok: true,
    mode: "manual",
    message: `${input.employee.name}：手動モードです。外部で作業後、成果物を登録してください。`
  };
}

async function executeApiStub(): Promise<AgentTaskResult> {
  await wait(200);
  return { ok: false, mode: "api", message: "APIモードは未接続です（今後実装予定）" };
}

// ---- 共通入口 ----

/**
 * AI社員にタスクを実行させる共通関数。
 * 呼び出し側（UI/ストア）はモードごとの違いを意識せず、この関数だけを使う。
 */
export async function executeAgentTask(input: AgentTaskInput, mode: ExecutionMode = "mock"): Promise<AgentTaskResult> {
  switch (mode) {
    case "mock":
      return executeMock(input);
    case "manual":
      return executeManual(input);
    case "codex":
      return runCodexTask({
        caseId: input.case.id,
        caseTitle: input.case.title,
        instruction: input.instruction ?? input.case.instruction ?? "",
        workDirectory: input.case.workDirectory,
        agentName: input.employee.name,
        jobType: input.case.jobType,
        expectedArtifactType: expectedArtifactTypeByJobType[input.case.jobType]
      });
    case "api":
      return executeApiStub();
  }
}
