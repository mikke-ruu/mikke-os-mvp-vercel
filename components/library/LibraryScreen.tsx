"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Clipboard,
  Download,
  FileText,
  Heart,
  Home,
  Inbox,
  Layers,
  Library,
  LinkIcon,
  Plus,
  Search,
  Sparkles,
  Star,
  Upload
} from "lucide-react";
import { MikkeAppShell, type MikkeShellBottomNavItem, type MikkeShellNavItem } from "@/components/mikkeos/MikkeAppShell";
import { MikkeEmptyState } from "@/components/mikkeos/MikkeEmptyState";
import { MikkeStatusBadge } from "@/components/mikkeos/MikkeStatusBadge";
import { useAuth } from "@/components/AuthGate";
import {
  createLibraryBlock,
  createLibraryComposition,
  createLibraryCompositionTemplate,
  createLibraryItem,
  createLibraryQuickMemo,
  formatCompositionText,
  loadLibraryStore,
  normalizeLibraryState,
  saveLibraryStore
} from "@/lib/library/store";
import { loadLibraryCloudStore, saveLibraryCloudStore } from "@/lib/library/supabase-store";
import {
  libraryBlockTypeLabels,
  libraryNextActionLabels,
  libraryStatusLabels,
  libraryTextKindLabels,
  type LibraryBlock,
  type LibraryBlockType,
  type LibraryComposition,
  type LibraryCompositionTemplate,
  type LibraryItem,
  type LibraryNextAction,
  type LibraryStatus,
  type LibraryStoreState,
  type LibraryTextKind
} from "@/lib/library/types";

type LibraryView = "home" | "library" | "memo" | "favorites" | "new" | "folders" | "archive" | "templates" | "backup";

const navItems: MikkeShellNavItem[] = [
  { label: "Home", href: "/apps/library?view=home", icon: Home, section: "Library" },
  { label: "Library", href: "/apps/library?view=library", icon: Library, section: "Library" },
  { label: "Quick memo", href: "/apps/library?view=memo", icon: Inbox, section: "Library" },
  { label: "Favorites", href: "/apps/library?view=favorites", icon: Heart, section: "Library" },
  { label: "New", href: "/apps/library?view=new", icon: Plus, section: "Library" },
  { label: "Folders", href: "/apps/library?view=folders", icon: BookOpen, section: "Library" },
  { label: "Archive", href: "/apps/library?view=archive", icon: Archive, section: "Library" },
  { label: "Templates", href: "/apps/library?view=templates", icon: Layers, section: "Tools" },
  { label: "Backup", href: "/apps/library?view=backup", icon: Download, section: "Tools" }
];

const bottomNavItems: MikkeShellBottomNavItem[] = [
  { label: "Home", href: "/apps/library?view=home", icon: Home },
  { label: "Library", href: "/apps/library?view=library", icon: Library },
  { label: "Memo", href: "/apps/library?view=memo", icon: Inbox },
  { label: "Favorites", href: "/apps/library?view=favorites", icon: Heart },
  { label: "New", href: "/apps/library?view=new", icon: Plus, primary: true }
];

const statusOptions = Object.keys(libraryStatusLabels) as LibraryStatus[];
const nextActionOptions = Object.keys(libraryNextActionLabels) as LibraryNextAction[];
const blockTypeOptions = Object.keys(libraryBlockTypeLabels) as LibraryBlockType[];
const textKindOptions = Object.keys(libraryTextKindLabels) as LibraryTextKind[];

type LibraryStarterTemplateId = "blank" | "team_works" | "academy" | "page" | "fund" | "item_studio" | "order";
type LibraryExampleTemplateId = "submission" | "ai_consult";
type LibraryTemplateBlockSeed = {
  type: LibraryBlockType;
  title: string;
  body: string;
  textKind?: LibraryTextKind;
  url?: string;
  dueDate?: string;
};

const libraryExampleTemplates: Array<{
  id: LibraryExampleTemplateId;
  title: string;
  helper: string;
  folder: string;
  tags: string[];
  blocks: LibraryTemplateBlockSeed[];
}> = [
  {
    id: "submission",
    title: "提出物を作る",
    helper: "依頼・材料・原案・整え文・提出前チェックの流れ。",
    folder: "提出物",
    tags: ["テンプレート", "提出物"],
    blocks: [
      { type: "memo", title: "依頼・条件", body: "提出先：\n期限：\n形式：\n必ず入れること：" },
      { type: "memo", title: "材料メモ", body: "参考URL：\n使いたい言葉：\n相手からの指示：" },
      { type: "text", title: "原案", body: "", textKind: "original" },
      { type: "text", title: "整え文", body: "", textKind: "polished" },
      { type: "task", title: "提出前チェック", body: "誤字確認\nURL確認\n提出形式確認\nコピーして提出", textKind: "original" }
    ]
  },
  {
    id: "ai_consult",
    title: "AI相談セット",
    helper: "相談したいこと、含める材料、守りたい原文、出してほしい形。",
    folder: "AI相談",
    tags: ["テンプレート", "AI相談"],
    blocks: [
      { type: "ai_consult", title: "相談したいこと", body: "何を一緒に考えてほしいか：" },
      { type: "memo", title: "含める材料", body: "前提：\n制約：\n参考：" },
      { type: "text", title: "守りたい原文", body: "", textKind: "original" },
      { type: "text", title: "AIからの案", body: "", textKind: "ai" }
    ]
  }
];

const starterTemplates: Array<{ id: LibraryStarterTemplateId; label: string; folder: string; blocks: Array<{ type: LibraryBlockType; title: string; body: string; textKind?: LibraryTextKind; dueDate?: string }> }> = [
  {
    id: "blank",
    label: "空のテーマ",
    folder: "Library",
    blocks: []
  },
  {
    id: "team_works",
    label: "Team Works提出物",
    folder: "Team Works",
    blocks: [
      { type: "memo", title: "依頼・指示", body: "提出先、期限、指定された形式、必ず入れる内容をここに整理する。" },
      { type: "memo", title: "材料メモ", body: "参考資料、URL、相手からのコメント、手元のメモを集める。" },
      { type: "text", title: "原案", body: "", textKind: "original" },
      { type: "text", title: "提出用の整え文", body: "", textKind: "polished" },
      { type: "memo", title: "提出前チェック", body: "目的、対象、本文、必要なURL、誤字、提出形式を確認する。" }
    ]
  },
  {
    id: "academy",
    label: "Academy講座説明",
    folder: "Academy",
    blocks: [
      { type: "memo", title: "講座の目的", body: "この講座で何をできるようにするか。" },
      { type: "memo", title: "対象者", body: "誰に向けた講座か。受講前の前提も残す。" },
      { type: "text", title: "講座説明の原案", body: "", textKind: "original" },
      { type: "text", title: "掲載用の整え文", body: "", textKind: "polished" },
      { type: "memo", title: "カリキュラム案", body: "章立て、教材、課題、認定や更新の流れ。" }
    ]
  },
  {
    id: "page",
    label: "Page掲載文",
    folder: "Page",
    blocks: [
      { type: "memo", title: "ページの目的", body: "このページで伝えたいこと、見た人に取ってほしい行動。" },
      { type: "text", title: "見出し案", body: "", textKind: "original" },
      { type: "text", title: "本文原案", body: "", textKind: "original" },
      { type: "text", title: "掲載用の整え文", body: "", textKind: "polished" },
      { type: "memo", title: "FAQ / CTA", body: "よくある質問、申込や問い合わせへの導線。" }
    ]
  },
  {
    id: "fund",
    label: "Fundプロジェクト文",
    folder: "Fund",
    blocks: [
      { type: "memo", title: "背景と目的", body: "なぜこの挑戦をするのか。誰に何が起きるのか。" },
      { type: "text", title: "応援をお願いする文章", body: "", textKind: "original" },
      { type: "memo", title: "リターン案", body: "返礼、参加権、報告方法、注意事項。" },
      { type: "text", title: "掲載用の整え文", body: "", textKind: "polished" }
    ]
  },
  {
    id: "item_studio",
    label: "Item Studio作品説明",
    folder: "Item Studio",
    blocks: [
      { type: "memo", title: "作品の特徴", body: "素材、サイズ、使い方、こだわり。" },
      { type: "text", title: "作品説明の原案", body: "", textKind: "original" },
      { type: "text", title: "販売用の整え文", body: "", textKind: "polished" },
      { type: "memo", title: "SNS用短文", body: "投稿用の短い説明やハッシュタグ。" }
    ]
  },
  {
    id: "order",
    label: "Order返信文",
    folder: "Order",
    blocks: [
      { type: "memo", title: "依頼内容", body: "相手の希望、納期、予算、確認事項。" },
      { type: "text", title: "返信文の原案", body: "", textKind: "original" },
      { type: "text", title: "送信用の整え文", body: "", textKind: "polished" },
      { type: "memo", title: "注意事項", body: "見積、支払い、納品、修正回数など。" }
    ]
  }
];

function createStarterBlocks(templateId: LibraryStarterTemplateId) {
  const template = starterTemplates.find((item) => item.id === templateId) ?? starterTemplates[0];
  return template.blocks.map((block) => createLibraryBlock({ type: block.type, title: block.title, body: block.body, textKind: block.textKind ?? "original", url: "", dueDate: block.dueDate }));
}

function createBlocksFromSeeds(blocks: LibraryTemplateBlockSeed[]) {
  return blocks.map((block) =>
    createLibraryBlock({
      type: block.type,
      title: block.title,
      body: block.body,
      textKind: block.textKind ?? "original",
      url: block.url,
      dueDate: block.dueDate
    })
  );
}

function createBlocksFromCompositionTemplate(template: LibraryCompositionTemplate) {
  const blocks: NonNullable<LibraryCompositionTemplate["blocks"]> = template.blocks?.length
    ? template.blocks
    : template.blockTitles.map((title) => ({ type: "text" as LibraryBlockType, title }));

  return blocks.map((block) =>
    createLibraryBlock({
      type: block.type,
      title: block.title,
      body: "",
      textKind: block.textKind ?? "original",
      customTypeLabel: block.customTypeLabel,
      customTextKindLabel: block.customTextKindLabel,
      url: block.url,
      dueDate: block.dueDate
    })
  );
}

function parseViewFromLocation(): LibraryView {
  if (typeof window === "undefined") return "home";
  const value = new URLSearchParams(window.location.search).get("view");
  if (value === "library" || value === "memo" || value === "favorites" || value === "new" || value === "folders" || value === "archive" || value === "templates" || value === "backup") return value;
  return "home";
}

function formatDate(value?: string) {
  if (!value) return "未設定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未設定";
  return new Intl.DateTimeFormat("ja-JP", { month: "2-digit", day: "2-digit" }).format(date);
}

function statusTone(status: LibraryStatus) {
  if (status === "complete") return "success" as const;
  if (status === "working") return "primary" as const;
  return "muted" as const;
}

function findFirstTextBlock(item: LibraryItem, kind?: LibraryTextKind) {
  return item.blocks.find((block) => block.type === "text" && (!kind || block.textKind === kind));
}

function blockTypeDisplay(block: LibraryBlock) {
  return block.type === "custom" ? block.customTypeLabel ?? libraryBlockTypeLabels[block.type] : libraryBlockTypeLabels[block.type];
}

function textKindDisplay(block: LibraryBlock) {
  if (!block.textKind) return null;
  return block.textKind === "custom" ? block.customTextKindLabel ?? libraryTextKindLabels[block.textKind] : libraryTextKindLabels[block.textKind];
}

export function LibraryScreen() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<LibraryStoreState>(() => loadLibraryStore());
  const [view, setView] = useState<LibraryView>(() => parseViewFromLocation());
  const [selectedItemId, setSelectedItemId] = useState<string>(() => loadLibraryStore().items[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<"syncing" | "saved" | "saving" | "error">("syncing");

  useEffect(() => {
    saveLibraryStore(state);
    if (!cloudReady) return;
    setCloudStatus("saving");
    if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = setTimeout(() => {
      void saveLibraryCloudStore(user.id, state)
        .then(() => setCloudStatus("saved"))
        .catch(() => setCloudStatus("error"));
    }, 650);

    return () => {
      if (cloudSaveTimer.current) clearTimeout(cloudSaveTimer.current);
    };
  }, [cloudReady, state, user.id]);

  useEffect(() => {
    let cancelled = false;
    setCloudReady(false);
    setCloudStatus("syncing");

    void loadLibraryCloudStore(user.id)
      .then(async (cloudState) => {
        if (cancelled) return;
        if (cloudState) {
          setState(cloudState);
          setSelectedItemId(cloudState.items[0]?.id ?? "");
          saveLibraryStore(cloudState);
        } else {
          const localState = loadLibraryStore();
          setState(localState);
          setSelectedItemId(localState.items[0]?.id ?? "");
          await saveLibraryCloudStore(user.id, localState);
        }
        if (!cancelled) {
          setCloudReady(true);
          setCloudStatus("saved");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCloudReady(true);
          setCloudStatus("error");
          setNotice("Supabase保存に接続できませんでした。端末内の保存で続行しています。");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user.id]);

  useEffect(() => {
    const onPopState = () => setView(parseViewFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const value = searchParams.get("view");
    if (value === "home" || value === "library" || value === "memo" || value === "favorites" || value === "new" || value === "folders" || value === "archive" || value === "templates" || value === "backup") {
      setView(value);
    }
  }, [searchParams]);

  const selectedItem = state.items.find((item) => item.id === selectedItemId) ?? state.items[0] ?? null;
  const activeItems = state.items.filter((item) => !item.archived && item.status !== "archive");
  const archivedItems = state.items.filter((item) => item.archived || item.status === "archive");
  const favoriteItems = activeItems.filter((item) => item.favorite);
  const folders = Array.from(new Set(activeItems.map((item) => item.folder || "Library"))).sort((a, b) => a.localeCompare(b, "ja"));

  const filteredItems = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return activeItems;
    return activeItems.filter((item) => {
      const haystack = [
        item.title,
        item.folder,
        ...item.tags,
        libraryStatusLabels[item.status],
        libraryNextActionLabels[item.nextAction],
        ...item.blocks.flatMap((block) => [block.title, block.body, block.url ?? ""])
      ].join(" ").toLowerCase();
      return haystack.includes(value);
    });
  }, [activeItems, query]);

  function updateState(update: (current: LibraryStoreState) => LibraryStoreState) {
    setState((current) => normalizeLibraryState(update(current)));
  }

  function openView(nextView: LibraryView) {
    setView(nextView);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/apps/library?view=${nextView}`);
    }
  }

  function upsertItem(nextItem: LibraryItem) {
    updateState((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === nextItem.id ? nextItem : item))
    }));
  }

  function handleCreateItem(title: string, folder: string, tags: string, templateId: LibraryStarterTemplateId, dueDate: string) {
    const starterTemplate = starterTemplates.find((template) => template.id === templateId) ?? starterTemplates[0];
    const item = {
      ...createLibraryItem({ title, folder: folder || starterTemplate.folder, tags: tags.split(",") }),
      folder: folder || starterTemplate.folder,
      dueDate: dueDate || undefined,
      nextAction: dueDate ? "review" as LibraryNextAction : "none" as LibraryNextAction,
      blocks: createStarterBlocks(templateId)
    };
    updateState((current) => ({ ...current, items: [item, ...current.items] }));
    setSelectedItemId(item.id);
    openView("library");
    setNotice("新しいテーマを作成しました。");
  }

  function handleUseExampleTemplate(templateId: LibraryExampleTemplateId) {
    const template = libraryExampleTemplates.find((item) => item.id === templateId) ?? libraryExampleTemplates[0];
    const item = {
      ...createLibraryItem({ title: template.title, folder: template.folder, tags: template.tags }),
      folder: template.folder,
      tags: template.tags,
      status: "working" as LibraryStatus,
      nextAction: "self_edit" as LibraryNextAction,
      blocks: createBlocksFromSeeds(template.blocks)
    };
    updateState((current) => ({ ...current, items: [item, ...current.items] }));
    setSelectedItemId(item.id);
    openView("library");
    setNotice("テンプレートから新規テーマを作成しました。");
  }

  function handleUseSavedTemplate(templateId: string) {
    const template = state.compositionTemplates?.find((item) => item.id === templateId);
    if (!template) return;
    const item = {
      ...createLibraryItem({ title: template.title, folder: "Library", tags: ["テンプレート"] }),
      status: "working" as LibraryStatus,
      nextAction: "self_edit" as LibraryNextAction,
      blocks: createBlocksFromCompositionTemplate(template)
    };
    updateState((current) => ({ ...current, items: [item, ...current.items] }));
    setSelectedItemId(item.id);
    openView("library");
    setNotice("保存したテンプレートから新規テーマを作成しました。");
  }

  function blockCopyText(block: LibraryBlock) {
    return [block.body, block.url].filter(Boolean).join("\n").trim();
  }

  function handleAddBlock(input: { type: LibraryBlockType; title: string; body: string; textKind: LibraryTextKind; customTypeLabel: string; customTextKindLabel: string; url: string; dueDate: string }, copyAfterSave = false) {
    if (!selectedItem) return;
    const block = createLibraryBlock({ ...input, textKind: input.type === "text" || input.type === "template_text" ? input.textKind : undefined });
    upsertItem({ ...selectedItem, blocks: [...selectedItem.blocks, block], updatedAt: new Date().toISOString() });
    setNotice(copyAfterSave ? "カードを追加してコピーしました。" : "カードを追加しました。");
    if (copyAfterSave) void copyText(blockCopyText(block));
  }

  function handleDuplicateBlock(block: LibraryBlock) {
    if (!selectedItem) return;
    const duplicate = createLibraryBlock({
          type: block.type,
          title: `${block.title} コピー`,
          body: block.body,
          textKind: block.textKind,
          customTypeLabel: block.customTypeLabel,
          customTextKindLabel: block.customTextKindLabel,
          url: block.url,
          dueDate: block.dueDate
        });
    upsertItem({ ...selectedItem, blocks: [...selectedItem.blocks, duplicate], updatedAt: new Date().toISOString() });
  }

  function handleMoveBlock(blockId: string, direction: -1 | 1) {
    if (!selectedItem) return;
    const index = selectedItem.blocks.findIndex((block) => block.id === blockId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selectedItem.blocks.length) return;
    const blocks = [...selectedItem.blocks];
    [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]];
    upsertItem({ ...selectedItem, blocks, updatedAt: new Date().toISOString() });
  }

  function handleDeleteBlock(blockId: string) {
    if (!selectedItem) return;
    upsertItem({
      ...selectedItem,
      blocks: selectedItem.blocks.filter((block) => block.id !== blockId),
      compositions: selectedItem.compositions.map((composition) => ({
        ...composition,
        blockIds: composition.blockIds.filter((id) => id !== blockId)
      })),
      updatedAt: new Date().toISOString()
    });
  }

  function handleUpdateBlock(blockId: string, input: { type: LibraryBlockType; title: string; body: string; textKind?: LibraryTextKind; customTypeLabel?: string; customTextKindLabel?: string; url?: string; dueDate?: string }, copyAfterSave = false) {
    if (!selectedItem) return;
    let copyValue = "";
    upsertItem({
      ...selectedItem,
      blocks: selectedItem.blocks.map((block) =>
        block.id === blockId
          ? (() => {
              const nextBlock: LibraryBlock = {
              ...block,
              type: input.type,
              title: input.title.trim() || input.body.split(/\r?\n/).map((line) => line.trim()).find(Boolean)?.slice(0, 28) || block.title,
              body: input.body,
              textKind: input.type === "text" || input.type === "template_text" ? input.textKind ?? block.textKind ?? "original" : undefined,
              customTypeLabel: input.type === "custom" ? input.customTypeLabel?.trim() || "自由設定" : undefined,
              customTextKindLabel: input.textKind === "custom" ? input.customTextKindLabel?.trim() || "自由入力" : undefined,
              url: input.url?.trim() || undefined,
              dueDate: input.dueDate || undefined,
              task: input.type === "task" ? {
                title: input.title.trim() || input.body.split(/\r?\n/).map((line) => line.trim()).find(Boolean)?.slice(0, 28) || block.title,
                dueDate: input.dueDate || undefined,
                priority: block.task?.priority ?? "normal",
                showInManager: block.task?.showInManager ?? false,
                completed: block.task?.completed ?? false
              } : undefined,
              updatedAt: new Date().toISOString()
            };
              copyValue = blockCopyText(nextBlock);
              return nextBlock;
            })()
          : block
      ),
      updatedAt: new Date().toISOString()
    });
    setNotice(copyAfterSave ? "カードを更新してコピーしました。" : "カードを更新しました。");
    if (copyAfterSave) void copyText(copyValue);
  }

  function handleCreateComposition(title: string, blockIds: string[]) {
    if (!selectedItem || blockIds.length === 0) return;
    const composition = createLibraryComposition(title, blockIds);
    upsertItem({ ...selectedItem, compositions: [...selectedItem.compositions, composition], updatedAt: new Date().toISOString() });
    setNotice("構成を作成しました。");
  }

  function handleRestoreItem(itemId: string) {
    updateState((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId
          ? { ...item, archived: false, status: item.status === "archive" ? "working" : item.status, updatedAt: new Date().toISOString() }
          : item
      )
    }));
    setSelectedItemId(itemId);
    openView("library");
    setNotice("アーカイブから復活しました。");
  }

  function handleSaveCompositionTemplate(title: string, blockIds: string[]) {
    if (!selectedItem || blockIds.length === 0) return;
    const blocks = blockIds.map((blockId) => selectedItem.blocks.find((block) => block.id === blockId)).filter((block): block is LibraryBlock => Boolean(block));
    const template = createLibraryCompositionTemplate(title, blocks);
    updateState((current) => ({
      ...current,
      compositionTemplates: [template, ...(current.compositionTemplates ?? [])]
    }));
    setNotice("構成テンプレートに保存しました。");
  }

  function handleSaveQuickMemo(body: string) {
    const trimmed = body.trim();
    if (!trimmed) return;
    updateState((current) => ({ ...current, quickMemos: [createLibraryQuickMemo(trimmed), ...current.quickMemos] }));
    setNotice("クイックメモを保存しました。");
  }

  function handleMemoToItem(memoId: string, mode: "new" | "copy" | "move") {
    const memo = state.quickMemos.find((item) => item.id === memoId);
    if (!memo) return;
    const item = selectedItem ?? createLibraryItem({ title: "クイックメモ" });
    const block = createLibraryBlock({ type: "memo", title: "クイックメモ", body: memo.body });
    updateState((current) => {
      let items = current.items;
      let selectedId = item.id;
      if (mode === "new" || !selectedItem) {
        const nextItem = {
          ...createLibraryItem({ title: memo.body.slice(0, 28) || "クイックメモ", folder: "Library" }),
          blocks: [block]
        };
        selectedId = nextItem.id;
        items = [nextItem, ...items];
      } else {
        items = items.map((currentItem) => (currentItem.id === item.id ? { ...currentItem, blocks: [...currentItem.blocks, block], updatedAt: new Date().toISOString() } : currentItem));
      }
      if (mode === "move") {
        setSelectedItemId(selectedId);
        return { ...current, items, quickMemos: current.quickMemos.filter((currentMemo) => currentMemo.id !== memoId) };
      }
      setSelectedItemId(selectedId);
      return { ...current, items };
    });
    openView("library");
  }

  async function copyText(text: string) {
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
    setNotice("コピーしました。");
  }

  function exportJson() {
    const nextState = { ...state, lastBackupAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(nextState, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mikke-library-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    updateState(() => nextState);
    setNotice("JSONバックアップを書き出しました。");
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as unknown;
        const nextState = normalizeLibraryState(parsed as LibraryStoreState);
        if (!Array.isArray(nextState.items) || !Array.isArray(nextState.quickMemos)) throw new Error("invalid");
        setState(nextState);
        setSelectedItemId(nextState.items[0]?.id ?? "");
        setNotice("JSONを読み込みました。");
      } catch {
        setNotice("このJSONは読み込めませんでした。");
      }
    };
    reader.readAsText(file);
  }

  return (
    <MikkeAppShell
      appName="Library"
      title="Library"
      subtitle="考えたことを、使える形へ。"
      currentApp={{ label: "Library", href: "/apps/library", icon: BookOpen }}
      theme="blue"
      navItems={navItems}
      bottomNavItems={bottomNavItems}
      footerLabel="Library by mikke"
    >
      <div className="space-y-5 pb-16 min-[900px]:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2">
            <Search size={17} className="shrink-0 text-[var(--mikke-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="テーマ、本文、タグを検索"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--mikke-muted-light)]"
            />
          </div>
          <button type="button" onClick={() => openView("new")} className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-3 py-2.5 text-xs font-bold text-white">
            <Plus size={16} /> 新規テーマ
          </button>
          <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${cloudStatus === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] text-[var(--mikke-muted)]"}`}>
            {cloudStatus === "syncing" ? "Supabase確認中" : cloudStatus === "saving" ? "保存中" : cloudStatus === "error" ? "端末内保存中" : "Supabase保存済み"}
          </span>
        </div>

        {notice ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-3 py-2 text-sm font-bold text-[var(--mikke-primary)]">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")} className="text-xs text-[var(--mikke-muted)]">閉じる</button>
          </div>
        ) : null}

        {view === "home" ? <HomeView items={activeItems} quickMemos={state.quickMemos} onOpenItem={(id) => { setSelectedItemId(id); openView("library"); }} onOpenView={openView} lastBackupAt={state.lastBackupAt} cloudStatus={cloudStatus} /> : null}
        {view === "library" ? <LibraryWorkspace items={filteredItems} selectedItem={selectedItem} onSelectItem={setSelectedItemId} onUpdateItem={upsertItem} onAddBlock={handleAddBlock} onUpdateBlock={handleUpdateBlock} onDuplicateBlock={handleDuplicateBlock} onDeleteBlock={handleDeleteBlock} onMoveBlock={handleMoveBlock} onCreateComposition={handleCreateComposition} onSaveCompositionTemplate={handleSaveCompositionTemplate} onCopy={copyText} /> : null}
        {view === "favorites" ? <ItemListView title="Favorites" items={favoriteItems} selectedItemId={selectedItem?.id ?? ""} onSelectItem={(id) => { setSelectedItemId(id); openView("library"); }} /> : null}
        {view === "folders" ? <FoldersView folders={folders} items={activeItems} onSelectItem={(id) => { setSelectedItemId(id); openView("library"); }} /> : null}
        {view === "archive" ? <ArchiveView items={archivedItems} onRestore={handleRestoreItem} /> : null}
        {view === "new" ? <NewItemView onCreate={handleCreateItem} /> : null}
        {view === "memo" ? <QuickMemoView memos={state.quickMemos} onSave={handleSaveQuickMemo} onMemoToItem={handleMemoToItem} onDelete={(memoId) => updateState((current) => ({ ...current, quickMemos: current.quickMemos.filter((memo) => memo.id !== memoId) }))} /> : null}
        {view === "templates" ? <TemplatesView templates={state.compositionTemplates ?? []} onUseExample={handleUseExampleTemplate} onUseSaved={handleUseSavedTemplate} /> : null}
        {view === "backup" ? <BackupView state={state} cloudStatus={cloudStatus} onExport={exportJson} onImport={importJson} /> : null}
      </div>
    </MikkeAppShell>
  );
}

function HomeView({ items, quickMemos, lastBackupAt, cloudStatus, onOpenItem, onOpenView }: { items: LibraryItem[]; quickMemos: { id: string; body: string; createdAt: string }[]; lastBackupAt?: string; cloudStatus: "syncing" | "saved" | "saving" | "error"; onOpenItem: (id: string) => void; onOpenView: (view: LibraryView) => void }) {
  const recent = items.slice(0, 3);
  const nextItems = items.filter((item) => item.nextAction !== "none").slice(0, 3);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <Section title="RECENT">
        {recent.length ? recent.map((item) => <ItemRow key={item.id} item={item} onClick={() => onOpenItem(item.id)} />) : <MikkeEmptyState title="まだテーマがありません" helper="最初の提出物やメモを作れます。" />}
      </Section>
      <Section title="NEXT">
        {nextItems.length ? nextItems.map((item) => <ItemRow key={item.id} item={item} onClick={() => onOpenItem(item.id)} />) : <MikkeEmptyState title="次の行動はありません" helper="提出、確認、公開などをテーマに付けられます。" />}
      </Section>
      <Section title="QUICK MEMO">
        {quickMemos.slice(0, 2).map((memo) => <p key={memo.id} className="border-t border-[var(--mikke-line)] py-3 text-sm leading-6 first:border-t-0">{memo.body}</p>)}
        <button type="button" onClick={() => onOpenView("memo")} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[var(--mikke-primary)]"><Inbox size={15} /> 受け箱を開く</button>
      </Section>
      <Section title="BACKUP">
        <p className="text-sm font-bold text-[var(--mikke-text)]">保存先: {cloudStatus === "error" ? "この端末" : "Supabase + この端末"}</p>
        <p className="mt-1 text-sm text-[var(--mikke-muted)]">最終JSONバックアップ: {lastBackupAt ? formatDate(lastBackupAt) : "未作成"}</p>
        <button type="button" onClick={() => onOpenView("backup")} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[var(--mikke-primary)]"><Download size={15} /> バックアップ</button>
      </Section>
    </div>
  );
}

function ItemListView({ title, items, selectedItemId, onSelectItem }: { title: string; items: LibraryItem[]; selectedItemId: string; onSelectItem: (id: string) => void }) {
  return (
    <Section title={title}>
      {items.length ? items.map((item) => <ItemRow key={item.id} item={item} active={item.id === selectedItemId} onClick={() => onSelectItem(item.id)} />) : <MikkeEmptyState title="表示するテーマがありません" />}
    </Section>
  );
}

function FoldersView({ folders, items, onSelectItem }: { folders: string[]; items: LibraryItem[]; onSelectItem: (id: string) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {folders.length ? folders.map((folder) => {
        const folderItems = items.filter((item) => (item.folder || "Library") === folder);
        return (
          <Section key={folder} title={folder}>
            <p className="mb-2 text-xs font-bold text-[var(--mikke-muted)]">{folderItems.length}件</p>
            {folderItems.map((item) => <ItemRow key={item.id} item={item} onClick={() => onSelectItem(item.id)} />)}
          </Section>
        );
      }) : <MikkeEmptyState title="フォルダはまだありません" helper="テーマ作成やテーマ編集でフォルダ名を入れると、ここにまとまります。" />}
    </div>
  );
}

function ArchiveView({ items, onRestore }: { items: LibraryItem[]; onRestore: (id: string) => void }) {
  return (
    <Section title="ARCHIVE">
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-[var(--mikke-line)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{item.title}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">{item.folder} ・ {item.tags[0] ?? "タグなし"} ・ 更新 {formatDate(item.updatedAt)}</p>
                </div>
                <button type="button" onClick={() => onRestore(item.id)} className="rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white">復活</button>
              </div>
            </div>
          ))}
        </div>
      ) : <MikkeEmptyState title="アーカイブは空です" helper="間違えてアーカイブしたテーマは、ここから復活できます。" />}
    </Section>
  );
}

function LibraryWorkspace(props: {
  items: LibraryItem[];
  selectedItem: LibraryItem | null;
  onSelectItem: (id: string) => void;
  onUpdateItem: (item: LibraryItem) => void;
  onAddBlock: (input: { type: LibraryBlockType; title: string; body: string; textKind: LibraryTextKind; customTypeLabel: string; customTextKindLabel: string; url: string; dueDate: string }, copyAfterSave?: boolean) => void;
  onUpdateBlock: (id: string, input: { type: LibraryBlockType; title: string; body: string; textKind?: LibraryTextKind; customTypeLabel?: string; customTextKindLabel?: string; url?: string; dueDate?: string }, copyAfterSave?: boolean) => void;
  onDuplicateBlock: (block: LibraryBlock) => void;
  onDeleteBlock: (id: string) => void;
  onMoveBlock: (id: string, direction: -1 | 1) => void;
  onCreateComposition: (title: string, blockIds: string[]) => void;
  onSaveCompositionTemplate: (title: string, blockIds: string[]) => void;
  onCopy: (text: string) => void;
}) {
  return (
    <div className="grid gap-5 min-[980px]:grid-cols-[320px_minmax(0,1fr)]">
      <ItemListView title="LIBRARY" items={props.items} selectedItemId={props.selectedItem?.id ?? ""} onSelectItem={props.onSelectItem} />
      {props.selectedItem ? <ThemeDetail {...props} item={props.selectedItem} /> : <MikkeEmptyState title="テーマを選択してください" />}
    </div>
  );
}

function ThemeDetail({ item, onUpdateItem, onAddBlock, onUpdateBlock, onDuplicateBlock, onDeleteBlock, onMoveBlock, onCreateComposition, onSaveCompositionTemplate, onCopy }: {
  item: LibraryItem;
  onUpdateItem: (item: LibraryItem) => void;
  onAddBlock: (input: { type: LibraryBlockType; title: string; body: string; textKind: LibraryTextKind; customTypeLabel: string; customTextKindLabel: string; url: string; dueDate: string }, copyAfterSave?: boolean) => void;
  onUpdateBlock: (id: string, input: { type: LibraryBlockType; title: string; body: string; textKind?: LibraryTextKind; customTypeLabel?: string; customTextKindLabel?: string; url?: string; dueDate?: string }, copyAfterSave?: boolean) => void;
  onDuplicateBlock: (block: LibraryBlock) => void;
  onDeleteBlock: (id: string) => void;
  onMoveBlock: (id: string, direction: -1 | 1) => void;
  onCreateComposition: (title: string, blockIds: string[]) => void;
  onSaveCompositionTemplate: (title: string, blockIds: string[]) => void;
  onCopy: (text: string) => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "composition" | "compare">("view");
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaTitle, setMetaTitle] = useState(item.title);
  const [metaFolder, setMetaFolder] = useState(item.folder);
  const [metaTags, setMetaTags] = useState(item.tags.join(", "));
  const [metaDueDate, setMetaDueDate] = useState(item.dueDate ?? "");

  useEffect(() => {
    setMetaTitle(item.title);
    setMetaFolder(item.folder);
    setMetaTags(item.tags.join(", "));
    setMetaDueDate(item.dueDate ?? "");
  }, [item.id, item.title, item.folder, item.tags, item.dueDate]);

  function saveMeta() {
    const title = metaTitle.trim();
    if (!title) return;
    onUpdateItem({
      ...item,
      title,
      folder: metaFolder.trim() || "Library",
      tags: metaTags.split(",").map((tag) => tag.trim()).filter(Boolean),
      dueDate: metaDueDate || undefined,
      updatedAt: new Date().toISOString()
    });
    setMetaOpen(false);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--mikke-line)] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-[var(--mikke-primary)]">{item.folder}</p>
            <h2 className="mt-1 text-xl font-bold tracking-normal">{item.title}</h2>
            <p className="mt-1 text-xs font-semibold text-[var(--mikke-muted)]">{item.tags.join(" / ") || "タグなし"} ・ 更新 {formatDate(item.updatedAt)}{item.dueDate ? ` ・ 期限 ${formatDate(item.dueDate)}` : ""}</p>
          </div>
          <button type="button" onClick={() => onUpdateItem({ ...item, favorite: !item.favorite, updatedAt: new Date().toISOString() })} className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--mikke-line)] text-[var(--mikke-primary)]" aria-label="お気に入り">
            <Star size={18} fill={item.favorite ? "currentColor" : "none"} />
          </button>
        </div>
        {metaOpen ? (
          <div className="mt-4 grid gap-3 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3 md:grid-cols-2">
            <input value={metaTitle} onChange={(event) => setMetaTitle(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm md:col-span-2" />
            <input value={metaFolder} onChange={(event) => setMetaFolder(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm" />
            <input value={metaTags} onChange={(event) => setMetaTags(event.target.value)} placeholder="タグ（カンマ区切り）" className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm" />
            <input type="date" value={metaDueDate} onChange={(event) => setMetaDueDate(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm" />
            <div className="flex gap-2 md:col-span-2">
              <button type="button" onClick={saveMeta} className="rounded-lg bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white">保存</button>
              <button type="button" onClick={() => setMetaOpen(false)} className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold">閉じる</button>
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <select value={item.status} onChange={(event) => onUpdateItem({ ...item, status: event.target.value as LibraryStatus, updatedAt: new Date().toISOString() })} className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold">
            {statusOptions.map((status) => <option key={status} value={status}>{libraryStatusLabels[status]}</option>)}
          </select>
          <select value={item.nextAction} onChange={(event) => onUpdateItem({ ...item, nextAction: event.target.value as LibraryNextAction, updatedAt: new Date().toISOString() })} className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold">
            {nextActionOptions.map((action) => <option key={action} value={action}>{libraryNextActionLabels[action]}</option>)}
          </select>
          <button type="button" onClick={() => setMetaOpen((current) => !current)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-muted)]">
            <FileText size={15} /> テーマ編集
          </button>
          <button type="button" onClick={() => { if (window.confirm("このテーマをアーカイブしますか？Archiveから復活できます。")) onUpdateItem({ ...item, archived: true, status: "archive", updatedAt: new Date().toISOString() }); }} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-2.5 py-2 text-xs font-bold text-[var(--mikke-muted-light)]">
            <Archive size={14} /> Archive
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["view", "edit", "composition", "compare"] as const).map((nextMode) => (
            <button key={nextMode} type="button" onClick={() => setMode(nextMode)} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === nextMode ? "bg-[var(--mikke-primary)] text-white" : "border border-[var(--mikke-line)] text-[var(--mikke-muted)]"}`}>
              {nextMode === "view" ? "中身" : nextMode === "edit" ? "編集" : nextMode === "composition" ? "構成" : "比較"}
            </button>
          ))}
        </div>
      </section>

      {mode === "view" ? <BlocksReadPanel item={item} onCopy={onCopy} /> : null}
      {mode === "edit" ? <BlocksPanel item={item} onAddBlock={onAddBlock} onUpdateBlock={onUpdateBlock} onDuplicateBlock={onDuplicateBlock} onDeleteBlock={onDeleteBlock} onMoveBlock={onMoveBlock} /> : null}
      {mode === "composition" ? <CompositionPanel item={item} onCreateComposition={onCreateComposition} onSaveCompositionTemplate={onSaveCompositionTemplate} onCopy={onCopy} /> : null}
      {mode === "compare" ? <ComparePanel item={item} onCopy={onCopy} /> : null}
    </div>
  );
}

function BlocksReadPanel({ item, onCopy }: { item: LibraryItem; onCopy: (text: string) => void }) {
  return (
    <section className="space-y-3">
      {item.blocks.length ? item.blocks.map((block) => (
        <article key={block.id} className="rounded-lg border border-[var(--mikke-line)] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <MikkeStatusBadge tone="muted" className="px-2 py-1">{blockTypeDisplay(block)}</MikkeStatusBadge>
                {textKindDisplay(block) ? <MikkeStatusBadge tone="primary" className="px-2 py-1">{textKindDisplay(block)}</MikkeStatusBadge> : null}
                {block.dueDate || block.task?.dueDate ? <MikkeStatusBadge tone="muted" className="px-2 py-1">期限 {formatDate(block.dueDate ?? block.task?.dueDate)}</MikkeStatusBadge> : null}
              </div>
              <h3 className="mt-2 text-base font-bold tracking-normal">{block.title}</h3>
            </div>
            <button type="button" onClick={() => onCopy([block.body, block.url].filter(Boolean).join("\n").trim())} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">
              <Clipboard size={15} /> コピー
            </button>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-text-soft)]">{block.body || "本文はまだありません。"}</p>
          {block.url ? <a href={block.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]"><LinkIcon size={14} /> {block.url}</a> : null}
        </article>
      )) : <MikkeEmptyState title="まだカードがありません" helper="編集タブからカードを追加できます。" />}
    </section>
  );
}

function BlocksPanel({ item, onAddBlock, onUpdateBlock, onDuplicateBlock, onDeleteBlock, onMoveBlock }: {
  item: LibraryItem;
  onAddBlock: (input: { type: LibraryBlockType; title: string; body: string; textKind: LibraryTextKind; customTypeLabel: string; customTextKindLabel: string; url: string; dueDate: string }, copyAfterSave?: boolean) => void;
  onUpdateBlock: (id: string, input: { type: LibraryBlockType; title: string; body: string; textKind?: LibraryTextKind; customTypeLabel?: string; customTextKindLabel?: string; url?: string; dueDate?: string }, copyAfterSave?: boolean) => void;
  onDuplicateBlock: (block: LibraryBlock) => void;
  onDeleteBlock: (id: string) => void;
  onMoveBlock: (id: string, direction: -1 | 1) => void;
}) {
  const [type, setType] = useState<LibraryBlockType>("text");
  const [textKind, setTextKind] = useState<LibraryTextKind>("original");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [customTextKindLabel, setCustomTextKindLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [editingBlockId, setEditingBlockId] = useState("");
  const [editType, setEditType] = useState<LibraryBlockType>("text");
  const [editTextKind, setEditTextKind] = useState<LibraryTextKind>("original");
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editCustomTypeLabel, setEditCustomTypeLabel] = useState("");
  const [editCustomTextKindLabel, setEditCustomTextKindLabel] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  function startEdit(block: LibraryBlock) {
    setEditingBlockId(block.id);
    setEditType(block.type);
    setEditTextKind(block.textKind ?? "original");
    setEditTitle(block.title);
    setEditBody(block.body);
    setEditUrl(block.url ?? "");
    setEditCustomTypeLabel(block.customTypeLabel ?? "");
    setEditCustomTextKindLabel(block.customTextKindLabel ?? "");
    setEditDueDate(block.dueDate ?? block.task?.dueDate ?? "");
  }

  function saveEdit(copyAfterSave = false) {
    if (!editingBlockId) return;
    onUpdateBlock(editingBlockId, { type: editType, title: editTitle, body: editBody, textKind: editTextKind, customTypeLabel: editCustomTypeLabel, customTextKindLabel: editCustomTextKindLabel, url: editUrl, dueDate: editDueDate }, copyAfterSave);
    setEditingBlockId("");
  }

  function addBlock(copyAfterSave = false) {
    onAddBlock({ type, title, body, textKind, customTypeLabel, customTextKindLabel, url, dueDate }, copyAfterSave);
    setTitle("");
    setBody("");
    setUrl("");
    setCustomTypeLabel("");
    setCustomTextKindLabel("");
    setDueDate("");
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--mikke-line)] bg-white p-4">
        <p className="text-sm font-bold">カードを追加</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select value={type} onChange={(event) => setType(event.target.value as LibraryBlockType)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm">
            {blockTypeOptions.map((option) => <option key={option} value={option}>{libraryBlockTypeLabels[option]}</option>)}
          </select>
          {type === "text" ? (
            <select value={textKind} onChange={(event) => setTextKind(event.target.value as LibraryTextKind)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm">
              {textKindOptions.map((option) => <option key={option} value={option}>{libraryTextKindLabels[option]}</option>)}
            </select>
          ) : null}
          {type === "template_text" ? (
            <select value={textKind} onChange={(event) => setTextKind(event.target.value as LibraryTextKind)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm">
              {textKindOptions.map((option) => <option key={option} value={option}>{libraryTextKindLabels[option]}</option>)}
            </select>
          ) : null}
          {type === "custom" ? <input value={customTypeLabel} onChange={(event) => setCustomTypeLabel(event.target.value)} placeholder="種類名（例: 挨拶文、注意事項）" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" /> : null}
          {(type === "text" || type === "template_text") && textKind === "custom" ? <input value={customTextKindLabel} onChange={(event) => setCustomTextKindLabel(event.target.value)} placeholder="分類名（例: SNS用、講師向け）" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" /> : null}
          {type === "task" ? <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" /> : null}
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="カード名" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm md:col-span-2" />
          {type === "url" ? <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="URL" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm md:col-span-2" /> : null}
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="本文" rows={5} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm leading-6 md:col-span-2" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => addBlock(false)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-3 py-2.5 text-xs font-bold text-white">
            <Plus size={16} /> 追加
          </button>
          <button type="button" onClick={() => addBlock(true)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2.5 text-xs font-bold">
            <Clipboard size={15} /> 追加してコピー
          </button>
        </div>
      </section>

      <section className="space-y-3">
        {item.blocks.length ? item.blocks.map((block, index) => (
          <article key={block.id} className="rounded-lg border border-[var(--mikke-line)] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2">
                  <MikkeStatusBadge tone="muted" className="px-2 py-1">{block.type === "custom" ? block.customTypeLabel ?? libraryBlockTypeLabels[block.type] : libraryBlockTypeLabels[block.type]}</MikkeStatusBadge>
                  {block.textKind ? <MikkeStatusBadge tone="primary" className="px-2 py-1">{block.textKind === "custom" ? block.customTextKindLabel ?? libraryTextKindLabels[block.textKind] : libraryTextKindLabels[block.textKind]}</MikkeStatusBadge> : null}
                  {block.dueDate || block.task?.dueDate ? <MikkeStatusBadge tone="muted" className="px-2 py-1">期限 {formatDate(block.dueDate ?? block.task?.dueDate)}</MikkeStatusBadge> : null}
                </div>
                <h3 className="mt-2 text-base font-bold tracking-normal">{block.title}</h3>
              </div>
              <div className="flex gap-1">
                <IconButton label="上へ" icon={ArrowUp} onClick={() => onMoveBlock(block.id, -1)} disabled={index === 0} />
                <IconButton label="下へ" icon={ArrowDown} onClick={() => onMoveBlock(block.id, 1)} disabled={index === item.blocks.length - 1} />
              </div>
            </div>
            {editingBlockId === block.id ? (
              <div className="mt-4 grid gap-3 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3 md:grid-cols-2">
                <select value={editType} onChange={(event) => setEditType(event.target.value as LibraryBlockType)} className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm">
                  {blockTypeOptions.map((option) => <option key={option} value={option}>{libraryBlockTypeLabels[option]}</option>)}
                </select>
                {editType === "text" ? (
                  <select value={editTextKind} onChange={(event) => setEditTextKind(event.target.value as LibraryTextKind)} className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm">
                    {textKindOptions.map((option) => <option key={option} value={option}>{libraryTextKindLabels[option]}</option>)}
                  </select>
                ) : null}
                {editType === "template_text" ? (
                  <select value={editTextKind} onChange={(event) => setEditTextKind(event.target.value as LibraryTextKind)} className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm">
                    {textKindOptions.map((option) => <option key={option} value={option}>{libraryTextKindLabels[option]}</option>)}
                  </select>
                ) : null}
                {editType === "custom" ? <input value={editCustomTypeLabel} onChange={(event) => setEditCustomTypeLabel(event.target.value)} placeholder="種類名" className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm" /> : null}
                {(editType === "text" || editType === "template_text") && editTextKind === "custom" ? <input value={editCustomTextKindLabel} onChange={(event) => setEditCustomTextKindLabel(event.target.value)} placeholder="分類名" className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm" /> : null}
                {editType === "task" ? <input type="date" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm" /> : null}
                <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm md:col-span-2" />
                {editType === "url" ? <input value={editUrl} onChange={(event) => setEditUrl(event.target.value)} placeholder="URL" className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm md:col-span-2" /> : null}
                <textarea value={editBody} onChange={(event) => setEditBody(event.target.value)} rows={6} className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm leading-6 md:col-span-2" />
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <button type="button" onClick={() => saveEdit(false)} className="rounded-lg bg-[var(--mikke-accent)] px-3 py-2 text-xs font-bold text-white">保存</button>
                  <button type="button" onClick={() => saveEdit(true)} className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold">保存してコピー</button>
                  <button type="button" onClick={() => setEditingBlockId("")} className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold">閉じる</button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-text-soft)]">{block.body}</p>
                {block.url ? <a href={block.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--mikke-primary)]"><LinkIcon size={14} /> {block.url}</a> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => startEdit(block)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">編集</button>
                  <button type="button" onClick={() => navigator.clipboard.writeText([block.body, block.url].filter(Boolean).join("\n").trim())} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">コピー</button>
                  <button type="button" onClick={() => onDuplicateBlock(block)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">複製</button>
                  <button type="button" onClick={() => onDeleteBlock(block.id)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-muted)]">削除</button>
                </div>
              </>
            )}
          </article>
        )) : <MikkeEmptyState title="まだカードがありません" helper="原案、AI文、整え文、URL、タスクを追加できます。" />}
      </section>
    </div>
  );
}

function CompositionPanel({ item, onCreateComposition, onSaveCompositionTemplate, onCopy }: { item: LibraryItem; onCreateComposition: (title: string, blockIds: string[]) => void; onSaveCompositionTemplate: (title: string, blockIds: string[]) => void; onCopy: (text: string) => void }) {
  const [title, setTitle] = useState("提出用");
  const [selected, setSelected] = useState<string[]>(item.blocks.filter((block) => block.type === "text" || block.type === "template_text").map((block) => block.id).slice(0, 2));
  const composition: LibraryComposition = item.compositions[0] ?? createLibraryComposition(title, selected);
  const preview = formatCompositionText(item, { ...composition, title, blockIds: selected });
  return (
    <section className="rounded-lg border border-[var(--mikke-line)] bg-white p-4">
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-bold">構成</p>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-3 w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
          <div className="mt-3 space-y-2">
            {item.blocks.map((block) => (
              <label key={block.id} className="flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm">
                <input type="checkbox" checked={selected.includes(block.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, block.id] : current.filter((id) => id !== block.id))} />
                <span>{block.title}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => onCreateComposition(title, selected)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-3 py-2.5 text-xs font-bold text-white">
              <Layers size={16} /> このテーマ内に保存
            </button>
            <button type="button" onClick={() => onSaveCompositionTemplate(title, selected)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2.5 text-xs font-bold">
              <Star size={15} /> テンプレートに保存
            </button>
          </div>
          {item.compositions.length ? (
            <div className="mt-4 rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
              <p className="text-xs font-bold text-[var(--mikke-muted)]">このテーマ内の保存済み構成</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.compositions.map((saved) => (
                  <button key={saved.id} type="button" onClick={() => { setTitle(saved.title); setSelected(saved.blockIds); }} className="rounded-lg border border-[var(--mikke-line)] bg-white px-2 py-1 text-xs font-bold">
                    {saved.title}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">プレビュー</p>
            <button type="button" onClick={() => onCopy(preview)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">
              <Clipboard size={15} /> コピー
            </button>
          </div>
          <pre className="mt-3 min-h-[260px] whitespace-pre-wrap rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4 text-sm leading-7">{preview || "使うカードを選んでください。"}</pre>
        </div>
      </div>
    </section>
  );
}

function ComparePanel({ item, onCopy }: { item: LibraryItem; onCopy: (text: string) => void }) {
  const original = findFirstTextBlock(item, "original") ?? item.blocks.find((block) => block.type === "text") ?? null;
  const ai = findFirstTextBlock(item, "ai") ?? findFirstTextBlock(item, "polished") ?? item.blocks.find((block) => block.type === "text" && block.id !== original?.id) ?? null;
  const [active, setActive] = useState<"a" | "b">("a");
  return (
    <section className="rounded-lg border border-[var(--mikke-line)] bg-white p-4">
      <div className="mb-3 flex gap-2 min-[760px]:hidden">
        <button type="button" onClick={() => setActive("a")} className={`rounded-lg px-3 py-2 text-xs font-bold ${active === "a" ? "bg-[var(--mikke-primary)] text-white" : "border border-[var(--mikke-line)]"}`}>A</button>
        <button type="button" onClick={() => setActive("b")} className={`rounded-lg px-3 py-2 text-xs font-bold ${active === "b" ? "bg-[var(--mikke-primary)] text-white" : "border border-[var(--mikke-line)]"}`}>B</button>
      </div>
      <div className="grid gap-4 min-[760px]:grid-cols-2">
        <ComparePane label="A" block={original} hiddenOnMobile={active !== "a"} onCopy={onCopy} />
        <ComparePane label="B" block={ai} hiddenOnMobile={active !== "b"} onCopy={onCopy} />
      </div>
    </section>
  );
}

function ComparePane({ label, block, hiddenOnMobile, onCopy }: { label: string; block: LibraryBlock | null; hiddenOnMobile: boolean; onCopy: (text: string) => void }) {
  return (
    <div className={`${hiddenOnMobile ? "hidden min-[760px]:block" : ""} rounded-lg border border-[var(--mikke-line)] p-4`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">{label}: {block?.title ?? "未選択"}</p>
        <button type="button" onClick={() => onCopy(block?.body ?? "")} className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)]" aria-label="コピー"><Clipboard size={15} /></button>
      </div>
      <p className="mt-3 min-h-[220px] whitespace-pre-wrap text-sm leading-7 text-[var(--mikke-text-soft)]">{block?.body ?? "比較できる文章カードがありません。"}</p>
    </div>
  );
}

function NewItemView({ onCreate }: { onCreate: (title: string, folder: string, tags: string, templateId: LibraryStarterTemplateId, dueDate: string) => void }) {
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState<LibraryStarterTemplateId>("team_works");
  const selectedTemplate = starterTemplates.find((template) => template.id === templateId) ?? starterTemplates[0];
  const [folder, setFolder] = useState(selectedTemplate.folder);
  const [tags, setTags] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    setFolder(selectedTemplate.folder);
  }, [selectedTemplate.folder]);

  return (
    <Section title="NEW">
      <div className="grid gap-3">
        <select value={templateId} onChange={(event) => setTemplateId(event.target.value as LibraryStarterTemplateId)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm">
          {starterTemplates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
        </select>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="提出物名、講座名、ページ名など" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
        <input value={folder} onChange={(event) => setFolder(event.target.value)} placeholder="フォルダ" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
        <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="タグ（カンマ区切り）" className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
        <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm" />
        {selectedTemplate.blocks.length ? (
          <div className="rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3">
            <p className="text-xs font-bold text-[var(--mikke-muted)]">作成されるカード</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedTemplate.blocks.map((block) => <span key={block.title} className="rounded-lg border border-[var(--mikke-line)] bg-white px-2 py-1 text-xs font-bold">{block.title}</span>)}
            </div>
          </div>
        ) : null}
        <button type="button" onClick={() => { onCreate(title, folder, tags, templateId, dueDate); setTitle(""); setTags(""); setDueDate(""); }} className="inline-flex w-fit items-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-3 py-2.5 text-xs font-bold text-white"><Plus size={16} /> 作成</button>
      </div>
    </Section>
  );
}

function QuickMemoView({ memos, onSave, onMemoToItem, onDelete }: { memos: { id: string; body: string; createdAt: string }[]; onSave: (body: string) => void; onMemoToItem: (memoId: string, mode: "new" | "copy" | "move") => void; onDelete: (memoId: string) => void }) {
  const [body, setBody] = useState("");
  return (
    <Section title="QUICK MEMO">
      <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} placeholder="とりあえず残す" className="w-full rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-sm leading-6" />
      <button type="button" onClick={() => { onSave(body); setBody(""); }} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-3 py-2.5 text-xs font-bold text-white"><Inbox size={16} /> 保存</button>
      <div className="mt-5 space-y-3">
        {memos.map((memo) => (
          <article key={memo.id} className="rounded-lg border border-[var(--mikke-line)] p-4">
            <p className="whitespace-pre-wrap text-sm leading-7">{memo.body}</p>
            <p className="mt-2 text-xs text-[var(--mikke-muted)]">{formatDate(memo.createdAt)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => onMemoToItem(memo.id, "new")} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">新規テーマ</button>
              <button type="button" onClick={() => onMemoToItem(memo.id, "copy")} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">選択テーマへコピー</button>
              <button type="button" onClick={() => onMemoToItem(memo.id, "move")} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold">選択テーマへ移動</button>
              <button type="button" onClick={() => onDelete(memo.id)} className="rounded-lg border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-muted)]">削除</button>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

function TemplatesView({ templates, onUseExample, onUseSaved }: { templates: LibraryCompositionTemplate[]; onUseExample: (templateId: LibraryExampleTemplateId) => void; onUseSaved: (templateId: string) => void }) {
  return (
    <Section title="TEMPLATES">
      <div className="space-y-5">
        <div>
          <p className="text-xs font-bold text-[var(--mikke-muted)]">見本</p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {libraryExampleTemplates.map((template) => (
              <div key={template.title} className="rounded-lg border border-[var(--mikke-line)] p-4">
                <p className="text-sm font-bold">{template.title}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{template.helper}</p>
                <button type="button" onClick={() => onUseExample(template.id)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white">
                  <Sparkles size={14} /> この見本で作成
                </button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-[var(--mikke-muted)]">保存したテンプレート</p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {templates.length ? templates.map((template) => (
              <div key={template.id} className="rounded-lg border border-[var(--mikke-line)] p-4">
                <p className="text-sm font-bold">{template.title}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">{template.blockTitles.join(" / ")}</p>
                <button type="button" onClick={() => onUseSaved(template.id)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white">
                  <Sparkles size={14} /> このテンプレートで作成
                </button>
              </div>
            )) : <MikkeEmptyState title="保存したテンプレートはまだありません" helper="構成画面の「テンプレートに保存」から追加できます。" />}
          </div>
        </div>
      </div>
    </Section>
  );
}

function BackupView({ state, cloudStatus, onExport, onImport }: { state: LibraryStoreState; cloudStatus: "syncing" | "saved" | "saving" | "error"; onExport: () => void; onImport: (file: File) => void }) {
  return (
    <Section title="BACKUP">
      <div className="grid gap-4 md:grid-cols-3">
        <InfoBox label="保存先" value={cloudStatus === "error" ? "この端末" : "Supabase + この端末"} />
        <InfoBox label="テーマ" value={`${state.items.length}件`} />
        <InfoBox label="最終バックアップ" value={state.lastBackupAt ? formatDate(state.lastBackupAt) : "未作成"} />
      </div>
      <p className="mt-4 text-sm leading-7 text-[var(--mikke-muted)]">ログイン中はSupabaseへ同期します。JSONバックアップは、手元に控えを持ち出したい時や別環境へ移したい時に使えます。</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onExport} className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-accent)] px-3 py-2.5 text-xs font-bold text-white"><Download size={16} /> JSONを書き出す</button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--mikke-line)] px-3 py-2.5 text-xs font-bold">
          <Upload size={16} /> JSONを読み込む
          <input type="file" accept="application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); }} />
        </label>
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--mikke-line)] bg-white p-4">
      <h2 className="text-sm font-bold uppercase text-[var(--mikke-primary)]" style={{ fontFamily: "var(--mikke-font-display)" }}>{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ItemRow({ item, active = false, onClick }: { item: LibraryItem; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`block w-full border-t border-[var(--mikke-line)] py-3 text-left first:border-t-0 ${active ? "text-[var(--mikke-primary)]" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{item.title}</p>
          <p className="mt-1 truncate text-xs font-semibold text-[var(--mikke-muted)]">{item.folder} ・ {item.tags[0] ?? "タグなし"} ・ {formatDate(item.updatedAt)}{item.dueDate ? ` ・ 期限 ${formatDate(item.dueDate)}` : ""}</p>
        </div>
        <MikkeStatusBadge tone={statusTone(item.status)} className="shrink-0 px-2 py-1">{libraryStatusLabels[item.status]}</MikkeStatusBadge>
      </div>
      {item.nextAction !== "none" ? <p className="mt-1 text-xs font-bold text-[var(--mikke-primary)]">Next: {libraryNextActionLabels[item.nextAction]}</p> : null}
    </button>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-4">
      <p className="text-xs font-bold text-[var(--mikke-muted)]">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function IconButton({ label, icon: Icon, onClick, disabled }: { label: string; icon: typeof ArrowUp; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--mikke-line)] text-[var(--mikke-muted)] disabled:opacity-30">
      <Icon size={15} />
    </button>
  );
}
