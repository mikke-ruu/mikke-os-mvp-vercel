import type {
  CaseStatus,
  Employee,
  JobType,
  OfficeCase,
  OfficeState,
  Priority,
  Room,
  RoomId
} from "./types";

// ---- 部屋定義 ----

export const rooms: Room[] = [
  { id: "reception", name: "受付・社長室", description: "案件の受付と全体統括を行う部屋" },
  { id: "advisor", name: "顧問室", description: "顧問AIが相談に乗る部屋" },
  { id: "course", name: "講座制作室", description: "認定講座の構築を進める部屋" },
  { id: "editing", name: "編集室", description: "テキスト編集・文章構成の部屋" },
  { id: "design", name: "デザイン室", description: "レイアウト・デザイン案を作る部屋" },
  { id: "coding", name: "実装室", description: "実装・プレビュー作業の部屋" },
  { id: "meeting", name: "会議室", description: "確認待ち案件のレビューと進行確認" },
  { id: "break", name: "休憩室", description: "コーヒーでひと息つく部屋" }
];

export const roomById = Object.fromEntries(rooms.map((r) => [r.id, r])) as Record<RoomId, Room>;

// ---- 初期社員（ダミー） ----

export const employees: Employee[] = [
  { id: "miketa", name: "ミケタ", role: "社長 / 統括", kind: "human", homeRoomId: "reception", color: "#2b3a67" },
  { id: "hakase", name: "ハカセAI", role: "顧問", kind: "ai", homeRoomId: "advisor", color: "#8d7b68" },
  { id: "aoi", name: "アオイAI", role: "講座担当", kind: "ai", homeRoomId: "course", color: "#3f7cac" },
  { id: "momoko", name: "モモコ", role: "編集担当", kind: "human", homeRoomId: "editing", color: "#c76b98" },
  { id: "rin", name: "リンAI", role: "デザイン担当", kind: "ai", homeRoomId: "design", color: "#e58f65" },
  { id: "coder", name: "コーダーAI", role: "実装担当", kind: "ai", homeRoomId: "coding", color: "#5a9367" },
  { id: "yu", name: "ユウ", role: "ファシリテーター", kind: "human", homeRoomId: "meeting", color: "#d9a441" },
  { id: "fuku", name: "フクさん", role: "サポート", kind: "human", homeRoomId: "break", color: "#7d6b91" }
];

export const employeeById = Object.fromEntries(employees.map((e) => [e.id, e])) as Record<string, Employee>;

// ---- 仕事の種類 ----

export const jobTypeLabels: Record<JobType, string> = {
  course: "講座構築",
  editing: "テキスト編集",
  design: "デザイン",
  coding: "実装",
  research: "調査",
  pr: "広報",
  support: "顧客対応",
  other: "その他"
};

/** 仕事の種類 → 自動アサインする担当 */
export const defaultAssigneeByJobType: Record<JobType, string> = {
  course: "aoi",
  editing: "momoko",
  design: "rin",
  coding: "coder",
  research: "hakase",
  pr: "yu",
  support: "fuku",
  other: "miketa"
};

/** 作業中のとき、仕事の種類 → 部屋 */
const workingRoomByJobType: Record<JobType, RoomId> = {
  course: "course",
  editing: "editing",
  design: "design",
  coding: "coding",
  research: "advisor",
  pr: "meeting",
  support: "reception",
  other: "reception"
};

/**
 * 案件の現在地（部屋）を決めるルール。
 * 受付→受付・社長室 / 作業中→種類ごとの部屋 / 確認待ち→会議室 / 完了→担当のホーム
 */
export function roomForCase(c: OfficeCase): RoomId {
  switch (c.status) {
    case "reception":
      return "reception";
    case "working":
      return workingRoomByJobType[c.jobType];
    case "review":
      return "meeting";
    case "done":
      return employeeById[c.assigneeId]?.homeRoomId ?? "break";
  }
}

// ---- 表示ラベル ----

export const statusLabels: Record<CaseStatus, string> = {
  reception: "受付",
  working: "作業中",
  review: "確認待ち",
  done: "完了"
};

export const statusOrder: CaseStatus[] = ["reception", "working", "review", "done"];

export const priorityLabels: Record<Priority, string> = {
  low: "低",
  normal: "中",
  high: "高"
};

// ---- 実行レイヤーの表示ラベル ----

export const executionModeLabels: Record<import("./types").ExecutionMode, string> = {
  mock: "デモ（mock）",
  manual: "手動（manual）",
  codex: "Claude Code（codex）",
  api: "API（未接続）"
};

export const executionModeDescriptions: Record<import("./types").ExecutionMode, string> = {
  mock: "ダミー返答のみのデモ用モードです",
  manual: "外部で作業した結果を手動で登録するモードです",
  codex: "これは将来Claude Code接続用のモードです（今は疑似実行のみ）",
  api: "今後のAPI接続用の枠です。まだ接続されていません"
};

export const executionStatusLabels: Record<import("./types").ExecutionStatus, string> = {
  idle: "未実行",
  queued: "キュー待ち",
  running: "実行中",
  waiting_review: "レビュー待ち",
  completed: "実行完了",
  failed: "失敗"
};

export const artifactTypeLabels: Record<import("./types").ArtifactType, string> = {
  text: "テキスト",
  html: "HTML下書き",
  layout: "レイアウト案",
  "build-json": "ビルドJSON",
  "image-brief": "画像生成指示",
  notes: "メモ"
};

// ---- 初期ダミー案件・ログ ----

function iso(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

export const initialState: OfficeState = {
  cases: [
    {
      id: "case-1",
      title: "認定講座構築案件 / 第1章テキスト整形",
      description: "第1章の本文テキストを整形して講座用に読みやすくする",
      jobType: "course",
      priority: "high",
      assigneeId: "aoi",
      status: "reception",
      team: "講座事業部",
      createdAt: iso(60),
      updatedAt: iso(60)
    },
    {
      id: "case-2",
      title: "認定講座構築案件 / 文章構成作成",
      description: "講座全体の文章構成を作成する",
      jobType: "editing",
      priority: "normal",
      assigneeId: "momoko",
      status: "working",
      team: "編集チーム",
      createdAt: iso(55),
      updatedAt: iso(40)
    },
    {
      id: "case-3",
      title: "認定講座構築案件 / デザイン案作成",
      description: "講座サイトのレイアウト・デザイン案を作成する",
      jobType: "design",
      priority: "normal",
      assigneeId: "rin",
      status: "working",
      team: "デザインチーム",
      createdAt: iso(50),
      updatedAt: iso(30)
    },
    {
      id: "case-4",
      title: "認定講座構築案件 / 実装プレビュー",
      description: "実装したページのプレビューを確認する",
      jobType: "coding",
      priority: "normal",
      assigneeId: "coder",
      status: "review",
      team: "AI開発チーム",
      createdAt: iso(45),
      updatedAt: iso(15)
    }
  ],
  logs: [
    { id: "log-1", time: "10:15", employeeId: "aoi", message: "案件を受付しました『認定講座構築案件 / 第1章テキスト整形』", createdAt: iso(45) },
    { id: "log-2", time: "10:18", employeeId: "momoko", message: "文章構成を作成中です", createdAt: iso(42) },
    { id: "log-3", time: "10:22", employeeId: "rin", message: "レイアウト案を作成中です", createdAt: iso(38) },
    { id: "log-4", time: "10:25", employeeId: "coder", message: "実装プレビューを開始しました", createdAt: iso(35) },
    { id: "log-5", time: "10:28", employeeId: "yu", message: "会議を14:00に設定しました（進捗確認）", createdAt: iso(32) }
  ]
};

// ---- サイドバー用ダミーデータ ----

export const teamSpaces = ["全社", "講座事業部", "AI開発チーム", "デザインチーム", "編集チーム", "サポートチーム"];
