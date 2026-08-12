"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BellRing,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  LogOut,
  Tag,
  UserRound,
  type LucideIcon
} from "lucide-react";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { EmailPreferencesCard } from "@/components/settings/EmailPreferencesCard";
import { MarketNoteShell } from "@/components/marketnote/MarketNoteShell";
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
    title: "収支項目",
    description: "売上・経費の分類を管理します。",
    href: "/settings/finance-categories",
    icon: Tag
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
  }
];

function SettingsContent() {
  const router = useRouter();
  const { user, profile, isGuest } = useAuth();

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const content = (
    <>
      {!isGuest ? <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
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
      </section> : (
        <section className="rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] p-4 shadow-sm">
          <h2 className="text-base font-bold tracking-normal text-[var(--mikke-text)]">ログインすると、別の端末でも続きが見られます</h2>
          <p className="mt-2 text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
            ログインせずに使っている記録と設定は、このブラウザに保存されます。
          </p>
          <Link href="/login?next=/marketnote" className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--mikke-orange)] px-4 text-sm font-bold text-white">
            ログイン
          </Link>
        </section>
      )}

      {!isGuest ? <SettingsSection title="共通設定" items={osItems} /> : null}
      {!isGuest ? <EmailPreferencesCard userId={user.id} /> : null}
      <SettingsSection title="MarketNoteの設定" items={marketNoteItems} />

      {!isGuest ? <section className="mt-4 rounded-2xl border border-[var(--mikke-line)] bg-[var(--mikke-surface)] shadow-sm">
        <button type="button" onClick={logout} className="grid w-full grid-cols-[34px_1fr_18px] items-center gap-2 px-3 py-3 text-left">
          <span className="grid h-8 w-8 place-items-center rounded-full text-[var(--mikke-text-soft)]"><LogOut size={18} /></span>
          <span>
            <span className="block text-sm font-bold text-[var(--mikke-text)]">ログアウト</span>
            <span className="mt-0.5 block text-xs font-semibold text-[var(--mikke-muted)]">この端末からログアウトします。</span>
          </span>
          <ChevronRight size={17} className="text-[var(--mikke-muted-light)]" />
        </button>
      </section> : null}
    </>
  );

  if (isGuest) {
    return (
      <MarketNoteShell title="設定" subtitle="MarketNote" isGuest>
        {content}
      </MarketNoteShell>
    );
  }

  return (
    <MikkeAppShell
      appName="Settings"
      title="設定"
      subtitle="プロフィール、アプリ連携、MarketNoteの設定を整理します。"
      currentApp={{ label: "Apps", href: "/apps" }}
      footerLabel="Settings by mikke"
    >
      {content}
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
    <AuthGate allowGuest>
      <SettingsContent />
    </AuthGate>
  );
}
