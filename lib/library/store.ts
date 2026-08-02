import { libraryDemoState } from "./demo";
import type {
  LibraryBlock,
  LibraryBlockType,
  LibraryComposition,
  LibraryCompositionTemplate,
  LibraryItem,
  LibraryNextAction,
  LibraryQuickMemo,
  LibraryStatus,
  LibraryStoreState,
  LibraryTextKind
} from "./types";

export const LIBRARY_STORAGE_KEY = "mikke.library.v1";

export type CreateLibraryItemInput = {
  title: string;
  folder?: string;
  tags?: string[];
};

export type CreateLibraryBlockInput = {
  type: LibraryBlockType;
  title: string;
  body: string;
  textKind?: LibraryTextKind;
  customTypeLabel?: string;
  customTextKindLabel?: string;
  url?: string;
  dueDate?: string;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createLibraryId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function titleFromBody(body: string, fallback: string) {
  const firstLine = body.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (!firstLine) return fallback;
  return firstLine.length > 28 ? `${firstLine.slice(0, 28)}...` : firstLine;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLibraryStoreState(value: unknown): value is LibraryStoreState {
  if (!isRecord(value)) return false;
  return value.version === 1 && Array.isArray(value.items) && Array.isArray(value.quickMemos);
}

function normalizeTags(tags: string[]) {
  return tags.map((tag) => tag.trim()).filter(Boolean);
}

function normalizeItem(item: LibraryItem): LibraryItem {
  return {
    ...item,
    folder: item.folder || "Library",
    tags: normalizeTags(item.tags ?? []),
    status: item.status ?? "idea",
    nextAction: item.nextAction ?? "none",
    favorite: item.favorite ?? false,
    archived: item.archived ?? false,
    blocks: Array.isArray(item.blocks) ? item.blocks : [],
    compositions: Array.isArray(item.compositions) ? item.compositions : []
  };
}

function normalizeCompositionTemplate(template: LibraryCompositionTemplate): LibraryCompositionTemplate {
  return {
    ...template,
    blockTitles: Array.isArray(template.blockTitles) ? template.blockTitles : [],
    blocks: Array.isArray(template.blocks)
      ? template.blocks.map((block) => ({
          type: block.type ?? "text",
          title: block.title || "無題のカード",
          textKind: block.textKind,
          customTypeLabel: block.customTypeLabel,
          customTextKindLabel: block.customTextKindLabel,
          url: block.url,
          dueDate: block.dueDate
        }))
      : undefined,
    includeHeadings: template.includeHeadings ?? true,
    format: template.format ?? "plain"
  };
}

export function normalizeLibraryState(state: LibraryStoreState): LibraryStoreState {
  return {
    version: 1,
    items: state.items.map(normalizeItem),
    quickMemos: state.quickMemos ?? [],
    compositionTemplates: (state.compositionTemplates ?? []).map(normalizeCompositionTemplate),
    lastBackupAt: state.lastBackupAt
  };
}

export function loadLibraryStore(): LibraryStoreState {
  if (typeof window === "undefined") return clone(libraryDemoState);
  const raw = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
  if (!raw) return clone(libraryDemoState);
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isLibraryStoreState(parsed) ? normalizeLibraryState(parsed) : clone(libraryDemoState);
  } catch {
    return clone(libraryDemoState);
  }
}

export function saveLibraryStore(state: LibraryStoreState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(normalizeLibraryState(state)));
}

export function createLibraryItem(input: CreateLibraryItemInput): LibraryItem {
  const title = input.title.trim();
  if (!title) throw new Error("タイトルを入力してください。");
  const now = new Date().toISOString();
  return {
    id: createLibraryId("library_item"),
    title,
    folder: input.folder?.trim() || "Library",
    tags: normalizeTags(input.tags ?? []),
    status: "idea",
    nextAction: "none",
    favorite: false,
    archived: false,
    blocks: [],
    compositions: [],
    createdAt: now,
    updatedAt: now
  };
}

export function createLibraryBlock(input: CreateLibraryBlockInput): LibraryBlock {
  const fallbackTitle = input.type === "url" && input.url ? input.url : titleFromBody(input.body, "無題のカード");
  const title = input.title.trim() || fallbackTitle;
  const now = new Date().toISOString();
  return {
    id: createLibraryId("library_block"),
    type: input.type,
    title,
    body: input.body,
    textKind: input.type === "text" || input.type === "template_text" ? input.textKind ?? "original" : input.textKind,
    customTypeLabel: input.type === "custom" ? input.customTypeLabel?.trim() || "自由設定" : input.customTypeLabel?.trim() || undefined,
    customTextKindLabel: input.textKind === "custom" ? input.customTextKindLabel?.trim() || "自由入力" : undefined,
    url: input.url?.trim() || undefined,
    dueDate: input.dueDate || undefined,
    task: input.type === "task" ? {
      title,
      dueDate: input.dueDate || undefined,
      priority: "normal",
      showInManager: false,
      completed: false
    } : undefined,
    createdAt: now,
    updatedAt: now
  };
}

export function createLibraryQuickMemo(body: string): LibraryQuickMemo {
  return {
    id: createLibraryId("library_memo"),
    body,
    createdAt: new Date().toISOString()
  };
}

export function createLibraryComposition(title: string, blockIds: string[]): LibraryComposition {
  const now = new Date().toISOString();
  return {
    id: createLibraryId("library_composition"),
    title: title.trim() || "構成",
    blockIds,
    includeHeadings: true,
    format: "plain",
    createdAt: now,
    updatedAt: now
  };
}

export function createLibraryCompositionTemplate(title: string, blocks: LibraryBlock[]): LibraryCompositionTemplate {
  const now = new Date().toISOString();
  return {
    id: createLibraryId("library_composition_template"),
    title: title.trim() || "構成テンプレート",
    blockTitles: blocks.map((block) => block.title),
    blocks: blocks.map((block) => ({
      type: block.type,
      title: block.title,
      textKind: block.textKind,
      customTypeLabel: block.customTypeLabel,
      customTextKindLabel: block.customTextKindLabel,
      url: block.url,
      dueDate: block.dueDate ?? block.task?.dueDate
    })),
    includeHeadings: true,
    format: "plain",
    createdAt: now,
    updatedAt: now
  };
}

export function updateLibraryItemMeta(
  item: LibraryItem,
  input: {
    status?: LibraryStatus;
    nextAction?: LibraryNextAction;
    favorite?: boolean;
    archived?: boolean;
  }
): LibraryItem {
  return {
    ...item,
    ...input,
    updatedAt: new Date().toISOString()
  };
}

export function formatCompositionText(item: LibraryItem, composition: LibraryComposition) {
  const blocks = composition.blockIds
    .map((blockId) => item.blocks.find((block) => block.id === blockId))
    .filter((block): block is LibraryBlock => Boolean(block));

  return blocks
    .map((block) => {
      const body = block.url ? `${block.body}\n${block.url}`.trim() : block.body.trim();
      if (!composition.includeHeadings) return body;
      if (composition.format === "markdown") return `## ${block.title}\n\n${body}`;
      return `【${block.title}】\n${body}`;
    })
    .filter(Boolean)
    .join("\n\n");
}
