export type LibraryStatus = "idea" | "working" | "complete" | "hold" | "archive";

export type LibraryNextAction = "none" | "ask_ai" | "self_edit" | "review" | "submit" | "publish" | "custom";

export type LibraryBlockType = "text" | "template_text" | "memo" | "ai_consult" | "url" | "task" | "custom";

export type LibraryTextKind = "original" | "ai" | "polished" | "revised" | "final" | "quote" | "custom";

export type LibraryTaskPriority = "low" | "normal" | "high";

export type LibraryTask = {
  title: string;
  dueDate?: string;
  priority: LibraryTaskPriority;
  showInManager: boolean;
  completed: boolean;
};

export type LibraryBlock = {
  id: string;
  type: LibraryBlockType;
  title: string;
  body: string;
  textKind?: LibraryTextKind;
  customTypeLabel?: string;
  customTextKindLabel?: string;
  url?: string;
  dueDate?: string;
  task?: LibraryTask;
  createdAt: string;
  updatedAt: string;
};

export type LibraryComposition = {
  id: string;
  title: string;
  blockIds: string[];
  includeHeadings: boolean;
  format: "plain" | "markdown";
  createdAt: string;
  updatedAt: string;
};

export type LibraryCompositionTemplate = {
  id: string;
  title: string;
  blockTitles: string[];
  blocks?: Array<{
    type: LibraryBlockType;
    title: string;
    textKind?: LibraryTextKind;
    customTypeLabel?: string;
    customTextKindLabel?: string;
    url?: string;
    dueDate?: string;
  }>;
  includeHeadings: boolean;
  format: "plain" | "markdown";
  createdAt: string;
  updatedAt: string;
};

export type LibraryItem = {
  id: string;
  title: string;
  folder: string;
  tags: string[];
  status: LibraryStatus;
  nextAction: LibraryNextAction;
  customNextAction?: string;
  dueDate?: string;
  favorite: boolean;
  archived: boolean;
  blocks: LibraryBlock[];
  compositions: LibraryComposition[];
  createdAt: string;
  updatedAt: string;
};

export type LibraryQuickMemo = {
  id: string;
  body: string;
  createdAt: string;
};

export type LibraryStoreState = {
  version: 1;
  items: LibraryItem[];
  quickMemos: LibraryQuickMemo[];
  compositionTemplates?: LibraryCompositionTemplate[];
  lastBackupAt?: string;
};

export const libraryStatusLabels: Record<LibraryStatus, string> = {
  idea: "アイデア",
  working: "作業中",
  complete: "完成",
  hold: "保留",
  archive: "アーカイブ"
};

export const libraryNextActionLabels: Record<LibraryNextAction, string> = {
  none: "なし",
  ask_ai: "AIへ相談",
  self_edit: "自分で修正",
  review: "確認する",
  submit: "提出する",
  publish: "公開する",
  custom: "自由入力"
};

export const libraryBlockTypeLabels: Record<LibraryBlockType, string> = {
  text: "文章",
  template_text: "定型文",
  memo: "メモ",
  ai_consult: "AI相談",
  url: "URL",
  task: "タスク",
  custom: "自由設定"
};

export const libraryTextKindLabels: Record<LibraryTextKind, string> = {
  original: "原案",
  ai: "AI文",
  polished: "整え文",
  revised: "修正版",
  final: "完成稿",
  quote: "引用",
  custom: "自由入力"
};
