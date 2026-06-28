"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  BellRing,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Database,
  ExternalLink,
  LogOut,
  PlusCircle,
  Settings as SettingsIcon,
  Tag,
  WalletCards
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthGate, useAuth } from "@/components/AuthGate";
import { MikkeAppSwitcher } from "@/components/MikkeAppSwitcher";
import { supabase } from "@/lib/supabase/client";

const revenueCategories = ["物販", "ワークショップ", "セッション", "オーダー", "予約金", "その他"];
const expenseCategories = ["出店料", "交通費", "お昼代", "仕入れ代", "駐車場代", "什器レンタル", "梱包材", "送料", "その他"];
const paymentMethods = ["現金", "QR", "カード", "ポイント", "その他"];

function SettingsContent() {
  const router = useRouter();
  const { profile } = useAuth();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMode, setCalendarMode] = useState("photo_profit");

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <AppShell title="設定" hideHeader>
      <div className="-mx-1 pb-2">
        <header className="mb-4 grid grid-cols-[40px_1fr_40px] items-center pt-1">
          <MikkeAppSwitcher />
          <h1 className="text-center text-xl font-semibold tracking-normal text-[#1f1b18]">設定</h1>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-[#1f1b18]" aria-label="通知">
            <Bell size={21} strokeWidth={1.7} />
          </button>
        </header>

        <ProfileCard profile={profile} />

        <section className="mt-4">
          <SectionTitle>MarketNoteの設定</SectionTitle>
          <div className="overflow-hidden rounded-2xl border border-[#e7e1dc] bg-white shadow-[0_4px_14px_rgba(45,33,22,0.04)]">
            <SettingsRow
              icon={<ClipboardCheck size={19} strokeWidth={1.7} />}
              title="チェックテンプレート"
              description="出店準備・当日確認などのセットを管理"
              href="/settings/check-templates"
            />
            <SettingsRow
              icon={<Tag size={19} strokeWidth={1.7} />}
              title="収支カテゴリ"
              description={`売上 ${revenueCategories.slice(0, 3).join("・")} / 経費 ${expenseCategories.slice(0, 3).join("・")}`}
            />
            <SettingsRow
              icon={<WalletCards size={19} strokeWidth={1.7} />}
              title="支払い方法"
              description={paymentMethods.join("・")}
            />
            <CalendarSettingsRow open={calendarOpen} value={calendarMode} onToggle={() => setCalendarOpen((current) => !current)} onChange={setCalendarMode} />
            <SettingsRow
              icon={<BellRing size={19} strokeWidth={1.7} />}
              title="通知 / リマインダー"
              description="期限や未入力をお知らせ"
            />
          </div>
        </section>

        <section className="mt-4">
          <SectionTitle>Mikke OS連携</SectionTitle>
          <div className="overflow-hidden rounded-2xl border border-[#e7e1dc] bg-white shadow-[0_4px_14px_rgba(45,33,22,0.04)]">
            <IntegrationRow mark="S" name="STORY" description="プロフィール・リンク集・活動記録をまとめて表示できます" actionPrimary="STORYを開く" actionSecondary="STORYで編集する" href="/story" />
            <IntegrationRow mark="D" name="DESK" description="MarketNoteの収支、他アプリの収支、領収書、請求書をまとめて管理" actionPrimary="DESKを開く" actionSecondary="連携設定" href="/desk" green />
          </div>
        </section>

        <section className="mt-4">
          <SectionTitle>アプリをホーム画面に追加</SectionTitle>
          <div className="overflow-hidden rounded-2xl border border-[#e7e1dc] bg-white shadow-[0_4px_14px_rgba(45,33,22,0.04)]">
            <HomeAppRow mark="M" name="MarketNote" action="追加する" active />
            <HomeAppRow mark="S" name="STORY" action="連携後に追加できます" />
            <HomeAppRow mark="D" name="DESK" action="連携後に追加できます" green />
          </div>
        </section>

        <section className="mt-4">
          <SectionTitle>その他</SectionTitle>
          <div className="overflow-hidden rounded-2xl border border-[#e7e1dc] bg-white shadow-[0_4px_14px_rgba(45,33,22,0.04)]">
            <SettingsRow icon={<Database size={18} strokeWidth={1.7} />} title="データ管理" description="エクスポート、バックアップは今後対応" />
            <SettingsRow icon={<CircleHelp size={18} strokeWidth={1.7} />} title="ヘルプ" description="使い方とサポート" />
            <button type="button" onClick={logout} className="grid w-full grid-cols-[34px_1fr_18px] items-center gap-2 border-t border-[#f1ece7] px-3 py-3 text-left">
              <span className="grid h-8 w-8 place-items-center rounded-full text-[#5f5a55]"><LogOut size={18} strokeWidth={1.7} /></span>
              <span>
                <span className="block text-sm font-extrabold text-[#1f1b18]">ログアウト</span>
                <span className="mt-0.5 block text-xs font-semibold text-[#8a817a]">この端末からログアウトします</span>
              </span>
              <ChevronRight size={17} strokeWidth={1.7} className="text-[#8a817a]" />
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function ProfileCard({ profile }: { profile: ReturnType<typeof useAuth>["profile"] }) {
  const initials = profile.display_name?.slice(0, 1) || "M";

  return (
    <section className="rounded-2xl border border-[#e7e1dc] bg-white shadow-[0_4px_14px_rgba(45,33,22,0.04)]">
      <div className="grid grid-cols-[72px_1fr] gap-3 p-4">
        <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-[#f4eee8] text-2xl font-semibold text-[#f46a14]">
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initials}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold tracking-normal text-[#1f1b18]">{profile.display_name}</h2>
          <p className="mt-1 text-xs font-bold text-[#5f5a55]">@{profile.handle}</p>
          <p className="mt-1 truncate text-xs font-semibold text-[#5f5a55]">{profile.bio || "ガラスアクセサリー / ワークショップ"}</p>
          <p className="mt-1 text-xs font-semibold text-[#8a817a]">{profile.area || "東京・神奈川"}</p>
          <p className="mt-2 text-[11px] font-bold text-[#8a817a]">このプロフィールはSTORYと共通です。</p>
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-[#f1ece7]">
        <Link href="/story" className="flex items-center justify-center gap-1.5 border-r border-[#f1ece7] py-2.5 text-xs font-extrabold text-[#f46a14]">
          <ExternalLink size={14} strokeWidth={1.8} />
          STORYで編集する
        </Link>
        <Link href="/story" className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-extrabold text-[#f46a14]">
          <ExternalLink size={14} strokeWidth={1.8} />
          STORYを開く
        </Link>
      </div>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 px-1 text-sm font-extrabold text-[#1f1b18]">{children}</h2>;
}

function SettingsRow({ icon, title, description, href }: { icon: React.ReactNode; title: string; description: string; href?: string }) {
  const content = (
    <>
      <span className="grid h-8 w-8 place-items-center rounded-full text-[#3b3530]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-extrabold text-[#1f1b18]">{title}</span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-[#8a817a]">{description}</span>
      </span>
      <ChevronRight size={17} strokeWidth={1.7} className="text-[#8a817a]" />
    </>
  );

  if (href) {
    return (
      <Link href={href} className="grid grid-cols-[34px_1fr_18px] items-center gap-2 border-b border-[#f1ece7] px-3 py-3 last:border-b-0">
        {content}
      </Link>
    );
  }

  return (
    <div className="grid grid-cols-[34px_1fr_18px] items-center gap-2 border-b border-[#f1ece7] px-3 py-3 last:border-b-0">
      {content}
    </div>
  );
}

function CalendarSettingsRow({ open, value, onToggle, onChange }: { open: boolean; value: string; onToggle: () => void; onChange: (value: string) => void }) {
  return (
    <div className="border-b border-[#f1ece7]">
      <button type="button" onClick={onToggle} className="grid w-full grid-cols-[34px_1fr_18px] items-center gap-2 px-3 py-3 text-left" aria-expanded={open}>
        <span className="grid h-8 w-8 place-items-center rounded-full text-[#3b3530]"><CalendarDays size={19} strokeWidth={1.7} /></span>
        <span className="min-w-0">
          <span className="block text-sm font-extrabold text-[#1f1b18]">カレンダー表示</span>
          <span className="mt-0.5 block truncate text-xs font-semibold text-[#8a817a]">終了後の表示を選択</span>
        </span>
        <ChevronDown size={17} strokeWidth={1.7} className={`text-[#8a817a] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="mx-3 mb-3 rounded-2xl border border-[#eee9e4] bg-[#fffdfb] p-3">
          {[
            ["photo_profit", "写真サムネ + 利益"],
            ["profit_only", "利益のみ"],
            ["closed_unrecorded", "終了 / 未記録"]
          ].map(([optionValue, label]) => (
            <button key={optionValue} type="button" onClick={() => onChange(optionValue)} className="flex w-full items-center gap-2 py-1.5 text-left text-sm font-bold text-[#3b3530]">
              <span className={`grid h-4 w-4 place-items-center rounded-full border ${value === optionValue ? "border-[#ff5a1f]" : "border-[#cfc7bf]"}`}>
                {value === optionValue ? <span className="h-2 w-2 rounded-full bg-[#ff5a1f]" /> : null}
              </span>
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function IntegrationRow({ mark, name, description, actionPrimary, actionSecondary, href, green = false }: { mark: string; name: string; description: string; actionPrimary: string; actionSecondary: string; href: string; green?: boolean }) {
  return (
    <div className="grid grid-cols-[48px_1fr_auto] gap-3 border-b border-[#f1ece7] px-3 py-3 last:border-b-0">
      <span className={`text-3xl font-semibold leading-none ${green ? "text-[#16833b]" : "text-[#f46a14]"}`}>{mark}</span>
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-[#1f1b18]">{name}</p>
        <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-5 text-[#6f6862]">{description}</p>
        <p className="mt-1 text-xs font-bold text-[#16833b]">連携済み</p>
      </div>
      <div className="flex min-w-[92px] flex-col items-end justify-center gap-2 text-xs font-extrabold text-[#f46a14]">
        <Link href={href} className="inline-flex items-center gap-1">{actionPrimary}<ExternalLink size={13} /></Link>
        <Link href={href} className="inline-flex items-center gap-1">{actionSecondary}<SettingsIcon size={13} /></Link>
      </div>
    </div>
  );
}

function HomeAppRow({ mark, name, action, active = false, green = false }: { mark: string; name: string; action: string; active?: boolean; green?: boolean }) {
  return (
    <div className="grid grid-cols-[34px_1fr_auto] items-center gap-2 border-b border-[#f1ece7] px-3 py-2.5 last:border-b-0">
      <span className={`text-2xl font-semibold leading-none ${green ? "text-[#16833b]" : "text-[#f46a14]"}`}>{mark}</span>
      <span className="text-sm font-extrabold text-[#1f1b18]">{name}</span>
      <span className={`inline-flex items-center gap-1 text-xs font-extrabold ${active ? "text-[#f46a14]" : "text-[#8a817a]"}`}>
        {action}
        <PlusCircle size={15} strokeWidth={1.7} />
      </span>
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
