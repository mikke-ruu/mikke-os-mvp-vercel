import {
  BookOpenText,
  Eye,
  Grid3X3,
  Link as LinkIcon,
  MessageSquareText,
  Palette,
  Sparkles,
  Type
} from "lucide-react";
import Link from "next/link";
import { OsShell } from "@/components/mikkeos/OsShell";

const editSections = [
  {
    id: "profile",
    title: "プロフィール",
    helper: "名前、肩書き、紹介文、写真、公開ステータスを整えます。",
    icon: BookOpenText,
    items: ["表示名", "肩書き", "紹介文", "プロフィール写真", "エリア"]
  },
  {
    id: "links",
    title: "リンク",
    helper: "SNS、予約、ショップ、公式サイトなど外部への入口をまとめます。",
    icon: LinkIcon,
    items: ["SNS", "予約ページ", "ショップ", "公式サイト", "お問い合わせ"]
  },
  {
    id: "portfolio",
    title: "作品・実績",
    helper: "Storyに出したい作品、講座、イベント、制作事例を選びます。",
    icon: Grid3X3,
    items: ["作品", "講座", "イベント", "制作事例", "表示順"]
  },
  {
    id: "reviews",
    title: "口コミ",
    helper: "公開するレビューや推薦文を選び、見え方を整えます。",
    icon: MessageSquareText,
    items: ["レビュー", "推薦文", "日付", "公開ON/OFF"]
  },
  {
    id: "visibility",
    title: "表示ON/OFF",
    helper: "公開ページに出す項目を選びます。",
    icon: Eye,
    items: ["活動サマリー", "作品", "口コミ", "リンク", "QR"]
  },
  {
    id: "design",
    title: "デザイン設定",
    helper: "背景色、画像、アクセントカラーを調整します。",
    icon: Palette,
    items: ["背景色", "背景画像", "アクセントカラー", "ボタン色"]
  },
  {
    id: "text",
    title: "文字サイズ",
    helper: "読みやすさに合わせて文字の大きさを調整します。",
    icon: Type,
    items: ["標準", "少し大きめ", "見出しサイズ"]
  },
  {
    id: "templates",
    title: "テンプレート",
    helper: "無料・有料テンプレートを選ぶ準備エリアです。",
    icon: Sparkles,
    items: ["シンプル", "講師向け", "作家向け", "ショップ向け"]
  }
];

export default function StoryEditPage() {
  return (
    <OsShell title="Storyを編集" subtitle="プロフィール、リンク、作品、見た目を整える画面" brandLabel="" showGlobalNav={false}>
      <div className="mx-auto max-w-3xl">
        <header className="mb-5 flex items-start justify-between gap-3 border-b border-[#e6e8ef] pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6b7280]">Story</p>
            <h1 className="mt-1 text-2xl font-bold tracking-normal text-[#111827]">Storyを編集</h1>
            <p className="mt-2 text-sm leading-6 text-[#4b5563]">公開プロフィールに出す内容と見た目をここで整えます。</p>
          </div>
          <Link href="/story" className="shrink-0 rounded-lg border border-[#dfe3ee] bg-white px-3 py-2 text-xs font-bold text-[#1f2a7a]">
            Storyを見る
          </Link>
        </header>

        <div className="grid gap-3">
          {editSections.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.id} id={section.id} className="rounded-lg border border-[#dfe3ee] bg-white p-4">
                <div className="flex gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#fff7ed] text-[#c75c1b]">
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold tracking-normal text-[#111827]">{section.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-[#4b5563]">{section.helper}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {section.items.map((item) => (
                        <span key={item} className="rounded-lg border border-[#dfe3ee] bg-[#f8fafc] px-3 py-1.5 text-xs font-bold text-[#4b5563]">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </OsShell>
  );
}
