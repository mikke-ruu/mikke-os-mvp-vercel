import type { LibraryStoreState } from "./types";

const now = "2026-07-31T00:00:00.000Z";

export const libraryDemoState: LibraryStoreState = {
  version: 1,
  lastBackupAt: undefined,
  compositionTemplates: [
    {
      id: "template_demo_submission",
      title: "提出物を作る",
      blockTitles: ["依頼・指示", "材料メモ", "原案", "提出用の整え文", "提出前チェック"],
      includeHeadings: true,
      format: "plain",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "template_demo_ai_consult",
      title: "AI相談セット",
      blockTitles: ["相談したいこと", "含める材料", "守りたい原文", "出してほしい形"],
      includeHeadings: true,
      format: "plain",
      createdAt: now,
      updatedAt: now
    }
  ],
  quickMemos: [
    {
      id: "memo_demo_1",
      body: "講座後のフォロー導線を、対面だけでなくオンラインにも分けて考える。",
      createdAt: now
    }
  ],
  items: [
    {
      id: "item_demo_1",
      title: "新しい講座企画案",
      folder: "Team Works",
      tags: ["認定講座リニューアル"],
      status: "working",
      nextAction: "review",
      favorite: true,
      archived: false,
      createdAt: now,
      updatedAt: now,
      blocks: [
        {
          id: "block_demo_instruction",
          type: "memo",
          title: "Team Worksの提出指示",
          body: "新しい講座企画案を、目的・対象者・講座内容・開講方法・準備物・今後の課題の順にまとめる。",
          createdAt: now,
          updatedAt: now
        },
        {
          id: "block_demo_original",
          type: "text",
          title: "講座企画案の原案",
          textKind: "original",
          body: "認定講座をリニューアルする。初めて学ぶ人が迷わないように、講座の目的と受講後の流れをわかりやすくしたい。",
          createdAt: now,
          updatedAt: now
        },
        {
          id: "block_demo_polished",
          type: "text",
          title: "提出用の整え文",
          textKind: "polished",
          body: "本企画では、認定講座の初回体験から受講後フォローまでを整理し、受講者が学習の目的と次の行動を理解しやすい講座設計へ更新する。",
          createdAt: now,
          updatedAt: now
        },
        {
          id: "block_demo_task",
          type: "task",
          title: "提出前に内容を確認する",
          body: "対象者、講座内容、準備物、今後の課題が入っているか確認する。",
          task: {
            title: "講座企画案を提出する",
            dueDate: "2026-08-10",
            priority: "high",
            showInManager: true,
            completed: false
          },
          createdAt: now,
          updatedAt: now
        }
      ],
      compositions: [
        {
          id: "composition_demo_submit",
          title: "Team Works提出用",
          blockIds: ["block_demo_polished"],
          includeHeadings: true,
          format: "plain",
          createdAt: now,
          updatedAt: now
        }
      ]
    }
  ]
};
