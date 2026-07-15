"use client";

import {
  BookOpenText,
  CalendarDays,
  ChevronRight,
  Download,
  Eye,
  Grid3X3,
  Link as LinkIcon,
  type LucideIcon,
  Menu,
  MessageSquareText,
  Palette,
  PlusCircle,
  QrCode,
  Rocket,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Type,
  UserPlus,
  UsersRound,
  X
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import { MikkeActionCard } from "./MikkeActionCard";
import { MikkeEmptyState } from "./MikkeEmptyState";
import { MikkeListRow } from "./MikkeListRow";
import { MikkeSection } from "./MikkeSection";
import { MikkeStatusBadge } from "./MikkeStatusBadge";
import { getAppPath } from "@/lib/mikkeos/routes";
import type { AppKey, UnifiedActivityLog, UnifiedProfile } from "@/lib/mikkeos/types";
import { getFundStoryParticipations, type FundStoryParticipation } from "@/lib/fund/story";

type SummaryItem = {
  label: string;
  value: string;
  unit: string;
  helper: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
};

type PortfolioItem = {
  title: string;
  label: string;
  imageUrl: string;
};

type ReviewItem = {
  source: string;
  body: string;
  date: string;
};

type PublicLinkItem = {
  title: string;
  helper: string;
  icon: LucideIcon;
};

const profileView = {
  displayName: "森田 あゆみ",
  handle: "ayumi",
  brandName: "Ayumi Story",
  area: "東京・神奈川・オンライン",
  bio: "マルシェの主催、講座運営、デザイン制作、個別セッションを行っています。あたたかいつながりと価値ある体験を届けることを大切に、活動を続けています。",
  avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=320&q=80",
  tags: ["講座運営", "マルシェ主催", "制作相談", "ブランド設計"],
  status: "制作依頼・相談 受付中"
};

const summaryItems: SummaryItem[] = [
  { label: "出店の主催", value: "23", unit: "回", helper: "累計", icon: Store },
  { label: "受注", value: "30", unit: "件", helper: "累計", icon: ShoppingBag },
  { label: "レビュー", value: "50", unit: "件", helper: "選択公開", icon: Star },
  { label: "セッション", value: "18", unit: "回", helper: "累計", icon: UsersRound }
];

const portfolioItems: PortfolioItem[] = [
  {
    title: "マルシェ主催",
    label: "Event",
    imageUrl: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=420&q=80"
  },
  {
    title: "講座運営",
    label: "Academy",
    imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=420&q=80"
  },
  {
    title: "ブランドデザイン",
    label: "Order",
    imageUrl: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=420&q=80"
  },
  {
    title: "Webデザイン",
    label: "Portfolio",
    imageUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=420&q=80"
  },
  {
    title: "商品・アクセサリー制作",
    label: "Item Studio",
    imageUrl: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=420&q=80"
  },
  {
    title: "フライヤーデザイン",
    label: "Design",
    imageUrl: "https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?auto=format&fit=crop&w=420&q=80"
  }
];

const reviews: ReviewItem[] = [
  {
    source: "受講生 Aさん",
    body: "いつも丁寧に寄り添ってくれて、前に進むきっかけになります。",
    date: "2025/05"
  },
  {
    source: "出店者 Bさん",
    body: "企画が素敵で、毎回たくさんのご縁が生まれます。",
    date: "2025/04"
  },
  {
    source: "クライアント Cさん",
    body: "提案力が高く、安心してお任せできます。",
    date: "2025/03"
  }
];

const publicLinks: PublicLinkItem[] = [
  { title: "Order", helper: "制作依頼・相談", icon: ShoppingBag },
  { title: "Session", helper: "予約・個別相談", icon: CalendarDays },
  { title: "外部リンク", helper: "SNS・公式サイト", icon: LinkIcon }
];

const publicPrograms = [
  { title: "はじめての講座づくり", label: "Academy", status: "受付中" },
  { title: "ほっこりマルシェ", label: "Event", status: "公開中" }
];

const ownedApps: Array<{ key: AppKey; name: string; helper: string }> = [
  { key: "market_note", name: "MarketNote", helper: "出店と活動を管理" },
  { key: "item_studio", name: "Item Studio", helper: "作品・商品を管理" },
  { key: "order", name: "Order", helper: "制作依頼を受ける" },
  { key: "session", name: "Session", helper: "予約と個別相談" },
  { key: "academy", name: "Academy", helper: "講座を管理" },
  { key: "fund", name: "Fund", helper: "挑戦と応援を管理" }
];

const otherAppItems: Array<{ href: string; name: string; helper: string }> = [
  { href: "/desk", name: "DESK", helper: "売上・経費を確認" },
  { href: "/apps", name: "アプリ一覧", helper: "使えるアプリを見る" }
];

const suggestedApps: Array<{ key: AppKey; name: string; helper: string }> = [
  { key: "community", name: "Community", helper: "会員・投稿・会費をまとめる" },
  { key: "event", name: "Event", helper: "イベント公開と申込をつなげる" }
];

const storyAdminItems: Array<{
  title: string;
  helper: string;
  href: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}> = [
  { title: "プロフィール", helper: "名前、肩書き、紹介文、写真を編集", href: "/story/edit#profile", icon: BookOpenText },
  { title: "リンク", helper: "SNS、予約、ショップ、公式サイトを整理", href: "/story/edit#links", icon: LinkIcon },
  { title: "作品・実績", helper: "表示する作品、講座、イベントを選ぶ", href: "/story/edit#portfolio", icon: Grid3X3 },
  { title: "口コミ", helper: "公開するレビューや推薦文を管理", href: "/story/edit#reviews", icon: MessageSquareText },
  { title: "表示ON/OFF", helper: "実績、作品、口コミ、リンクの出し方を選ぶ", href: "/story/edit#visibility", icon: Eye },
  { title: "デザイン設定", helper: "背景色、画像、アクセントカラーを調整", href: "/story/edit#design", icon: Palette },
  { title: "文字サイズ", helper: "読みやすさに合わせて文字を調整", href: "/story/edit#text", icon: Type },
  { title: "テンプレート", helper: "無料・有料テンプレートを選ぶ準備", href: "/story/edit#templates", icon: Sparkles }
];

export function StoryProfile({ profile, logs }: { profile: UnifiedProfile; logs: UnifiedActivityLog[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [fundParticipations, setFundParticipations] = useState<FundStoryParticipation[]>([]);
  const storyMaterialCount = logs.filter((log) => log.visibility === "public" && log.storyEnabled).length + fundParticipations.length;
  const fundStoryLogs = logs.filter((log) => log.appKey === "fund" && log.eventType === "fund_project_completed" && log.visibility === "public" && log.storyEnabled);
  const displayName = profileView.displayName || profile.displayName;

  useEffect(() => {
    let cancelled = false;
    getFundStoryParticipations(profileView.handle)
      .then((items) => {
        if (!cancelled) setFundParticipations(items);
      })
      .catch(() => {
        if (!cancelled) setFundParticipations([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl text-[var(--mikke-text)]">
      {menuOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="メニューを閉じる"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-[var(--mikke-backdrop)]"
          />
          <aside className="absolute inset-y-0 right-0 w-[min(92vw,430px)] overflow-y-auto bg-white p-4 shadow-2xl">
            <StoryOwnerMenu onClose={() => setMenuOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="overflow-hidden bg-white">
        <section className="border-b border-[var(--mikke-line)] pb-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mikke-muted)]">Story</p>
              <h2 className="mt-1 text-xl font-bold tracking-normal">{profileView.brandName}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Storyを共有"
                className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--mikke-primary)]"
              >
                <Share2 size={18} />
              </button>
              <button
                type="button"
                aria-label="Storyメニュー"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((current) => !current)}
                className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--mikke-primary)]"
              >
                <Menu size={20} />
              </button>
            </div>
          </div>

          <div className="mt-5 flex gap-4">
            <img
              src={profileView.avatarUrl}
              alt={`${displayName}のプロフィール写真`}
              className="h-24 w-24 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-normal">{displayName}</h1>
              <p className="mt-1 text-sm font-semibold text-[var(--mikke-muted)]">@{profileView.handle}</p>
              <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-[var(--mikke-muted)]">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--mikke-success)]" />
                {profileView.area}
              </p>
              <MikkeStatusBadge tone="primary" withDot className="mt-3">
                {profileView.status}
              </MikkeStatusBadge>
            </div>
          </div>

          <p className="mt-4 text-sm leading-7 text-[var(--mikke-text-soft)]">{profileView.bio}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {profileView.tags.map((tag) => (
              <span key={tag} className="rounded-lg border border-[var(--mikke-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <nav className="grid grid-cols-5 border-b border-[var(--mikke-line)] text-[var(--mikke-muted)]">
          <StoryTab active icon={BookOpenText} label="概要" />
          <StoryTab icon={Grid3X3} label="作品" />
          <StoryTab icon={MessageSquareText} label="口コミ" />
          <StoryTab icon={LinkIcon} label="リンク" />
          <StoryTab icon={QrCode} label="QR" />
        </nav>

        <section className="border-b border-[var(--mikke-line-soft)] py-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold tracking-normal">活動サマリー</h2>
            <p className="text-xs font-bold text-[var(--mikke-muted)]">公開素材 {storyMaterialCount}件</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {summaryItems.map((item) => (
              <SummaryCard key={item.label} item={item} />
            ))}
          </div>
        </section>

        <MikkeSection title="作品ポートフォリオ" action="すべて見る">
          {portfolioItems.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {portfolioItems.map((item) => (
                <article key={item.title} className="group relative aspect-square overflow-hidden rounded-lg bg-[var(--mikke-surface-soft)]">
                  <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="w-fit rounded bg-white/90 px-2 py-1 text-[10px] font-bold text-[var(--mikke-text)]">{item.label}</p>
                    <h3 className="mt-1 line-clamp-2 text-xs font-bold leading-4 text-white">{item.title}</h3>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <MikkeEmptyState title="表示する作品はまだありません" helper="公開する作品を選ぶとここに並びます。" />
          )}
        </MikkeSection>

        <MikkeSection title="口コミ" action="すべて見る">
          {reviews.length > 0 ? (
            <div className="grid gap-2 min-[560px]:grid-cols-3">
              {reviews.map((review) => (
                <article key={review.source} className="rounded-lg border border-[var(--mikke-line)] bg-white p-3">
                  <div className="flex items-center gap-2 text-[var(--mikke-primary)]">
                    <MessageSquareText size={16} />
                    <p className="text-xs font-bold">{review.source}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--mikke-text-soft)]">{review.body}</p>
                  <p className="mt-2 text-xs font-semibold text-[var(--mikke-muted-light)]">{review.date}</p>
                </article>
              ))}
            </div>
          ) : (
            <MikkeEmptyState title="公開中の口コミはまだありません" helper="公開する口コミを選ぶとここに並びます。" />
          )}
        </MikkeSection>

        <MikkeSection title="依頼・リンク">
          <div className="grid gap-2 min-[560px]:grid-cols-3">
            {publicLinks.map((item) => (
              <MikkeActionCard key={item.title} title={item.title} helper={item.helper} icon={item.icon} />
            ))}
          </div>
        </MikkeSection>

        <MikkeSection title="公開中・挑戦の記録">
          {publicPrograms.length > 0 || fundStoryLogs.length > 0 || fundParticipations.length > 0 ? (
            <div className="grid gap-2">
              {publicPrograms.map((program) => (
                <MikkeListRow
                  key={program.title}
                  title={program.title}
                  label={program.label}
                  right={<MikkeStatusBadge>{program.status}</MikkeStatusBadge>}
                />
              ))}
              {fundStoryLogs.map((log) => (
                <MikkeListRow
                  key={`${log.eventType}:${log.sourceId}`}
                  title={log.title}
                  label="Fund"
                  helper={log.description}
                  icon={Rocket}
                  href={log.metadata?.publicPath}
                  right={<MikkeStatusBadge tone="success">挑戦の軌跡</MikkeStatusBadge>}
                />
              ))}
              {fundParticipations.map((participation) => (
                <MikkeListRow
                  key={participation.participationId}
                  title={`${participation.projectTitle}を応援しています`}
                  label="Fund"
                  helper="応援として参加"
                  icon={UsersRound}
                  href={participation.publicFundPath}
                  right={<MikkeStatusBadge tone="success">応援中</MikkeStatusBadge>}
                />
              ))}
            </div>
          ) : (
            <MikkeEmptyState title="公開中の講座・イベントはまだありません" helper="公開する項目を選ぶとここに並びます。" />
          )}
        </MikkeSection>

        <section className="grid gap-4 border-t border-[var(--mikke-line-soft)] py-5 min-[560px]:grid-cols-[1fr_160px]">
          <div className="flex flex-col justify-center">
            <h2 className="text-base font-bold tracking-normal">QRコード</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--mikke-muted)]">このStoryページを共有できます。</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-[var(--mikke-primary)] px-4 py-2 text-sm font-bold text-[var(--mikke-primary)]">
                <Download size={16} />
                QRコードを保存
              </button>
              <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-[var(--mikke-primary)] px-4 py-2 text-sm font-bold text-white">
                <UserPlus size={16} />
                つながる
              </button>
            </div>
          </div>
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https%3A%2F%2Fstory.mikke.example%2Fayumi"
            alt="Story共有用QRコード"
            className="h-40 w-40 rounded-lg border border-[var(--mikke-line)] bg-white p-2"
          />
        </section>

        <footer className="border-t border-[var(--mikke-line-soft)] py-4 text-center text-xs font-semibold text-[var(--mikke-muted-light)]">Story by mikke</footer>
      </div>
    </div>
  );
}

function StoryOwnerMenu({ onClose }: { onClose?: () => void }) {
  return (
    <section className="rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-normal">Storyメニュー</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--mikke-muted)]">
            Storyの編集、使っているアプリ、これからつなげられるアプリをまとめています。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/story/edit" className="rounded-lg bg-[var(--mikke-primary)] px-3 py-2 text-xs font-bold text-white">
            編集
          </Link>
          {onClose ? (
            <button
              type="button"
              aria-label="メニューを閉じる"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)]"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div>
          <p className="mb-2 text-xs font-bold text-[var(--mikke-primary)]">Storyを編集</p>
          <div className="grid gap-2">
            {storyAdminItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.title} href={item.href} className="flex items-center gap-3 rounded-lg border border-[var(--mikke-line)] bg-white p-3 text-left">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--mikke-accent-soft)] text-[var(--mikke-accent-strong)]">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{item.title}</span>
                    <span className="mt-0.5 block text-xs font-semibold leading-5 text-[var(--mikke-muted)]">{item.helper}</span>
                  </span>
                  <ChevronRight className="ml-auto shrink-0 text-[var(--mikke-muted-light)]" size={16} />
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold text-[var(--mikke-primary)]">使っているアプリ</p>
          <div className="grid gap-2">
            {ownedApps.map((app) => (
              <Link key={app.key} href={getAppPath(app.key)} className="flex items-center gap-3 rounded-lg border border-[var(--mikke-line)] bg-white p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]">
                  <Grid3X3 size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{app.name}</span>
                  <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--mikke-muted)]">{app.helper}</span>
                </span>
                <ChevronRight className="ml-auto shrink-0 text-[var(--mikke-muted-light)]" size={16} />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-bold text-[var(--mikke-primary)]">他のアプリ</p>
        <div className="grid gap-2">
          {otherAppItems.map((app) => (
            <Link key={app.href} href={app.href} className="flex items-center gap-3 rounded-lg border border-[var(--mikke-line)] bg-white p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]">
                <Grid3X3 size={18} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{app.name}</span>
                <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--mikke-muted)]">{app.helper}</span>
              </span>
              <ChevronRight className="ml-auto shrink-0 text-[var(--mikke-muted-light)]" size={16} />
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-[var(--mikke-primary-border)] bg-white p-3">
        <p className="text-xs font-bold text-[var(--mikke-primary)]">つなげられるアプリ</p>
        <div className="mt-2 grid gap-2 min-[560px]:grid-cols-2">
          {suggestedApps.map((app) => (
            <div key={app.key} className="flex items-center gap-3 rounded-lg bg-[var(--mikke-surface-soft)] p-3">
              <PlusCircle className="shrink-0 text-[var(--mikke-primary)]" size={20} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{app.name}</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-[var(--mikke-muted)]">{app.helper}</p>
              </div>
              <button type="button" className="shrink-0 rounded-lg border border-[var(--mikke-primary-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--mikke-primary)]">
                つなげますか
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StoryTab({
  icon: Icon,
  label,
  active = false
}: {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex min-h-16 flex-col items-center justify-center gap-1 border-b-2 px-1 text-xs font-bold ${
        active ? "border-[var(--mikke-primary)] text-[var(--mikke-primary)]" : "border-transparent text-[var(--mikke-muted)]"
      }`}
    >
      <Icon size={20} strokeWidth={1.9} />
      {label}
    </button>
  );
}

function SummaryCard({ item }: { item: SummaryItem }) {
  const Icon = item.icon;

  return (
    <article className="min-h-28 rounded-lg border border-[var(--mikke-line)] bg-white p-2 text-center">
      <div className="mx-auto grid h-8 w-8 place-items-center rounded-lg bg-[var(--mikke-primary-soft)] text-[var(--mikke-primary)]">
        <Icon size={18} />
      </div>
      <p className="mt-2 text-[11px] font-bold leading-4 text-[var(--mikke-text-soft)]">{item.label}</p>
      <p className="mt-1 text-2xl font-bold tracking-normal text-[var(--mikke-text)]">
        {item.value}
        <span className="ml-0.5 text-xs font-bold">{item.unit}</span>
      </p>
      <p className="text-[11px] font-semibold text-[var(--mikke-muted-light)]">{item.helper}</p>
    </article>
  );
}
