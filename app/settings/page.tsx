"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BellRing,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Database,
  ExternalLink,
  LogOut,
  Settings as SettingsIcon,
  Tag,
  UserRound,
  WalletCards,
  type LucideIcon
} from "lucide-react";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { MikkeAppShell } from "@/components/mikkeos/MikkeAppShell";
import { supabase } from "@/lib/supabase/client";

type SettingsItem = {
  title: string;
  description: string;
  href?: string;
  icon: LucideIcon;
};

const marketNoteItems: SettingsItem[] = [
  {
    title: "チェックテンプレート",
    description: "出店準備・当日確認などのセットを管理します。",
    href: "/settings/check-templates",
    icon: ClipboardCheck
  },
  {
    title: "収支カテゴリ",
    description: "売上・経費の分類を管理します。",
    href: "/settings/finance-categories",
    icon: Tag
  },
  {
    title: "支払い方法",
    description: "現金、QR、カード、振込などを管理します。",
    href: "/settings/payment-methods",
    icon: WalletCards
  },
  {
    title: "通知 / リマインダー",
    description: "期限や確認事項の表示を調整します。",
    href: "/settings/reminders",
    icon: BellRing
  }
];

const osItems: SettingsItem[] = [
  {
    title: "Storyを編集",
    description: "公開プロフィール、リンク、表示内容を調整します。",
    href: "/story/edit",
    icon: UserRound
  },
  {
    title: "Activity Log",
    description: "通常ナビには出さず、必要な時だけ確認します。",
    href: "/log",
    icon: Database
  },
  {
    title: "Apps",
    description: "使っているアプリと、これから繋げられるアプリを確認します。",
    href: "/apps",
    icon: SettingsIcon
  }
];

function SettingsContent() {
  const router = useRouter();
  const { profile } = useAuth();

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <MikkeAppShell
      appName="Settings"
      title="設定"
      subtitle="プロフィール、アプリ連携、MarketNoteの設定を整理します。"
      currentApp={{ label: "Apps", href: "/apps" }}
      footerLabel="Settings by mikke"
    >
      <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-[var(--mikke-accent-soft)] text-xl font-bold text-[var(--mikke-accent)]">
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : profile.display_name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold tracking-normal text-[var(--mikke-text)]">{profile.display_name}</h2>
            <p className="mt-1 text-xs font-bold text-[var(--mikke-muted)]">@{profile.handle}</p>
            <p className="mt-1 truncate text-xs font-semibold text-[var(--mikke-text-soft)]">{profile.bio || "プロフィールはStoryと共通です。"}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href="/story/edit" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-accent)]">
            Storyを編集 <ExternalLink size={14} />
          </Link>
          <Link href="/story" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--mikke-line)] px-3 py-2 text-xs font-bold text-[var(--mikke-accent)]">
            Storyを開く <ExternalLink size={14} />
          </Link>
        </div>
      </section>

      <SettingsSection title="共通設定" items={osItems} />
      <SettingsSection title="MarketNoteの設定" items={marketNoteItems} />

      <section className="mt-4 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] shadow-sm">
        <SettingsRow icon={CircleHelp} title="ヘルプ" description="使い方とサポート導線は後続で追加します。" />
        <button type="button" onClick={logout} className="grid w-full grid-cols-[34px_1fr_18px] items-center gap-2 border-t border-[var(--mikke-line-soft)] px-3 py-3 text-left">
          <span className="grid h-8 w-8 place-items-center rounded-full text-[var(--mikke-text-soft)]"><LogOut size={18} /></span>
          <span>
            <span className="block text-sm font-bold text-[var(--mikke-text)]">ログアウト</span>
            <span className="mt-0.5 block text-xs font-semibold text-[var(--mikke-muted)]">この端末からログアウトします。</span>
          </span>
          <ChevronRight size={17} className="text-[var(--mikke-muted-light)]" />
        </button>
      </section>
    </MikkeAppShell>
  );
}

function SettingsSection({ title, items }: { title: string; items: SettingsItem[] }) {
  return (
    <section className="mt-4">
      <h2 className="mb-2 px-1 text-sm font-bold text-[var(--mikke-text)]">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] shadow-sm">
        {items.map((item) => (
          <SettingsRow key={item.title} {...item} />
        ))}
      </div>
    </section>
  );
}

function SettingsRow({ icon: Icon, title, description, href }: SettingsItem) {
  const content = (
    <>
      <span className="grid h-8 w-8 place-items-center rounded-full text-[var(--mikke-text-soft)]"><Icon size={18} /></span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-[var(--mikke-text)]">{title}</span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--mikke-muted)]">{description}</span>
      </span>
      <ChevronRight size={17} className="text-[var(--mikke-muted-light)]" />
    </>
  );

  if (href) {
    return (
      <Link href={href} className="grid grid-cols-[34px_1fr_18px] items-center gap-2 border-b border-[var(--mikke-line-soft)] px-3 py-3 last:border-b-0">
        {content}
      </Link>
    );
  }

  return (
    <div className="grid grid-cols-[34px_1fr_18px] items-center gap-2 border-b border-[var(--mikke-line-soft)] px-3 py-3 last:border-b-0">
      {content}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGate>
      <SettingsContent />
    </AuthGate>
  );
}
