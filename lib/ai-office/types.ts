// mikke AI OFFICE — 型定義
// AI社員と人間が一緒に働くバーチャルオフィスのMVP。
// Supabase / Team Works 本接続は将来。今回はlocalStorageのみ。

export type CaseStatus = "reception" | "working" | "review" | "done";

export type JobType =
  | "course" // 講座構築
  | "editing" // テキスト編集
  | "design" // デザイン
  | "coding" // 実装
  | "research" // 調査
  | "pr" // 広報
  | "support" // 顧客対応
  | "other";

export type Priority = "low" | "normal" | "high";

export type RoomId =
  | "reception" // 受付・社長室
  | "advisor" // 顧問室
  | "course" // 講座制作室
  | "editing" // 編集室
  | "design" // デザイン室
  | "coding" // 実装室
  | "meeting" // 会議室
  | "break" // 休憩室
  | "terrace"; // みっけテラス

export type EmployeeKind = "ai" | "human";

export type EmployeeState = "working" | "idle" | "break";

export type Employee = {
  id: string;
  name: string;
  role: string;
  kind: EmployeeKind;
  /** 所属している部屋（ホームポジション） */
  homeRoomId: RoomId;
  /** キャラクターの基調カラー（スプライト生成に使う） */
  color: string;
};

/** 実行ジョブの状態（案件のワークフローstatusとは別軸） */
export type ExecutionStatus = "idle" | "queued" | "running" | "waiting_review" | "completed" | "failed";

/** 成果物の種類。将来のmikkeOSビルド連携（layout / build-json）を見据えた枠 */
export type ArtifactType = "text" | "html" | "layout" | "build-json" | "image-brief" | "notes";

export type Artifact = {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  createdAt: string; // ISO
};

export type OfficeCase = {
  id: string;
  title: string;
  description: string;
  jobType: JobType;
  priority: Priority;
  assigneeId: string;
  status: CaseStatus;
  /** 関連チーム（任意） */
  team?: string;
  /** 納期（YYYY-MM-DD 簡易文字列） */
  dueDate?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO

  // ---- 実行レイヤー（フェーズ3で追加。旧データ互換のためすべて任意） ----
  /** この案件の実行モード。未設定は mock 扱い */
  executionMode?: ExecutionMode;
  /** 作業フォルダ（任意。codex本接続時に使用予定。今はまだ使わない） */
  workDirectory?: string;
  /** 実行用の指示文 */
  instruction?: string;
  /** 成果物一覧 */
  artifacts?: Artifact[];
  /** 実行ジョブの状態。未設定は idle 扱い */
  executionStatus?: ExecutionStatus;
  lastRunAt?: string; // ISO
  lastRunSummary?: string;
  /** 完了前に人のレビューを必須にするか */
  reviewRequired?: boolean;
};

export type ActivityLogEntry = {
  id: string;
  /** HH:mm 表示用 */
  time: string;
  employeeId: string;
  message: string;
  createdAt: string; // ISO
};

export type Room = {
  id: RoomId;
  name: string;
  /** 部屋の説明（ツールチップやガイド用） */
  description: string;
};

/** localStorageに保存する状態全体 */
export type OfficeState = {
  cases: OfficeCase[];
  logs: ActivityLogEntry[];
};

// ---- エージェント実行レイヤー ----
// mock: ダミー返答（デモ用） / manual: 人が外部作業して成果物を手入力
// codex: 将来Claude Code接続。今は疑似実行 / api: 将来のAPI接続。今は未接続stub

export type ExecutionMode = "mock" | "manual" | "codex" | "api";

export type AgentTaskInput = {
  case: OfficeCase;
  employee: Employee;
  instruction?: string;
};

export type AgentTaskResult = {
  ok: boolean;
  mode: ExecutionMode;
  message: string;
  /** 実行が成果物を生んだ場合（codex疑似実行など） */
  artifact?: Omit<Artifact, "id" | "createdAt">;
};

/**
 * 将来Claude Code CLI / SDK / runnerへ渡す想定の実行リクエスト。
 * 本接続時はこの型のまま外部ランナーへ引き渡せる形にしておく。
 */
export type CodexTaskRequest = {
  caseId: string;
  caseTitle: string;
  instruction: string;
  workDirectory?: string;
  agentName: string;
  jobType: JobType;
  expectedArtifactType: ArtifactType;
};
