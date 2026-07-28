"use client";

import { BookOpen, Briefcase, CalendarDays, Folder, Home, MessageSquare, Plus, Settings, Users } from "lucide-react";
import { MikkeAppShell, type MikkeShellBottomNavItem, type MikkeShellNavItem } from "@/components/mikkeos/MikkeAppShell";

/**
 * 承認済みクリックプロトタイプ`.side` `.nav`の6項目（順序・section区切りとも忠実に再現）が土台。
 * 2026-07-26、クライアント側もパートナーと同じ「名簿登録＋プロジェクトへのアサイン」方式に
 * 変更したため、あゆみ指示で「パートナー管理」の直後に「クライアント管理」を追加（7項目）。
 */
const teamWorksNavItems: MikkeShellNavItem[] = [
  { label: "ホーム", href: "/apps/team-works", icon: Home },
  { label: "スケジュール管理", href: "/apps/team-works/schedule", icon: CalendarDays, section: "運営" },
  { label: "メッセージ管理", href: "/apps/team-works/messages", icon: MessageSquare, section: "運営" },
  { label: "プロジェクト管理", href: "/apps/team-works/projects", icon: Folder, section: "運営" },
  { label: "パートナー管理", href: "/apps/team-works/partners", icon: Users, section: "運営" },
  { label: "クライアント管理", href: "/apps/team-works/clients", icon: Briefcase, section: "運営" },
  { label: "マニュアル管理", href: "/apps/team-works/manuals", icon: BookOpen, section: "運営" },
  { label: "企業設定", href: "/apps/team-works/settings", icon: Settings, section: "設定" }
];

/**
 * モバイル下部メニュー（プロトタイプ`.bottom`＝アイコンのみ5枠）: ホーム/案件(プロジェクト管理)/＋新規/マニュアル/パートナー。
 * 「＋新規」はプロトタイプではデモalertの未実装ボタン（Phase Aは機能追加をしない指示のため新規作成フローは作らない）。
 * 遷移先は既に新規プロジェクト作成ができる「プロジェクト管理」一覧にした（判断: ビルドプランに明記が無いため、
 * 既存機能を壊さず・新規機能も足さない範囲でモックの導線位置だけを再現する選択）。
 */
const teamWorksBottomNavItems: MikkeShellBottomNavItem[] = [
  { label: "ホーム", href: "/apps/team-works", icon: Home },
  { label: "プロジェクト管理", href: "/apps/team-works/projects", icon: Folder },
  { label: "新規プロジェクト", href: "/apps/team-works/projects/new", icon: Plus, primary: true },
  { label: "マニュアル管理", href: "/apps/team-works/manuals", icon: BookOpen },
  { label: "パートナー管理", href: "/apps/team-works/partners", icon: Users }
];

/**
 * Team Works 本部系ページ共通の外枠。
 * あゆみ2026-07-24是正指示により、暫定の上部タブ3項目を廃止し、承認済みモックの
 * 「PC=常時左サイドメニュー6項目／スマホ=☰ドロワー＋下部アイコン5枠」をMikkeAppShellのnavItems/bottomNavItemsで配線する。
 */
export function TeamWorksOperationsShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <MikkeAppShell
      appName="Team Works"
      title={title}
      subtitle={subtitle}
      theme="green"
      footerLabel="Team Works by mikke"
      navItems={teamWorksNavItems}
      bottomNavItems={teamWorksBottomNavItems}
      ownedApps={[]}
      otherApps={[]}
      suggestedApps={[]}
    >
      {children}
    </MikkeAppShell>
  );
}
