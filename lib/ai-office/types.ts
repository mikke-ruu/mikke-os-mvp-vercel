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

// ---- エージェント実行レイヤー（今回はmockのみ実装） ----

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
};
