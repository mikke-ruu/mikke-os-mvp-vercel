"use client";

import {
  ChevronDown,
  Copy,
  Grid3X3,
  Link as LinkIcon,
  LogOut,
  PlusCircle,
  Settings,
  X
} from "lucide-react";
import Link from "next/link";
import { useState, type ComponentType, type ReactNode } from "react";
import { releasedApps } from "@/lib/mikkeos/released-apps";
import type { StatChipTone } from "./StatChip";

type OwnerMenuIcon = ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;

export type MikkeOwnerMenuItem = {
  title: string;
  /** @deprecated 軽量ドロワーでは説明文を表示しない。型のみ後方互換で残す。 */
  helper?: string;
  href: string;
  icon?: OwnerMenuIcon;
  tone?: StatChipTone;
};

export type MikkeOwnerMenuSuggestedApp = {
  name: string;
  helper: string;
  href?: string;
};

export type MikkeOwnerMenuProps = {
  appName: string;
  /** メニューのアクティブ囲い等に使うアプリ別アクセント色（5色固定パレットから選ぶ）。 */
  theme?: StatChipTone;
  /** @deprecated 未使用。型のみ後方互換で残す。 */
  description?: string;
  editItems?: MikkeOwnerMenuItem[];
  ownedApps?: MikkeOwnerMenuItem[];
  otherApps?: MikkeOwnerMenuItem[];
  suggestedApps?: MikkeOwnerMenuSuggestedApp[];
  mikkeId?: string;
  isGuest?: boolean;
  onSignOut?: () => void;
  /** ヘッダー行に close ボタンと並べる追加アクション（STORYの「編集」ボタン等）。 */
  headerAction?: ReactNode;
  onClose?: () => void;
};

const defaultEditItems: MikkeOwnerMenuItem[] = [{ title: "表示設定", href: "/settings", icon: Settings }];

const defaultOwnedApps = releasedApps;

const defaultSuggestedApps: MikkeOwnerMenuSuggestedApp[] = [
  { name: "Community", helper: "Communityを作成・運営しますか", href: "/community/for-organizers" }
];

/**
 * 濃色(blue/orange)は白アイコン・淡色(pink/yellow/green)は黒アイコン（StatChipの可読性ルールと統一）。
 * APPSタイルだけでなく、PC常時サイドバー／モバイル下部メニューのアクティブ差し色にも同じ表を使い、
 * 「5色を濃くも薄くもしない」ルールを守ったまま各所でコントラストが崩れないようにする。
 */
export const tileToneStyles: Record<StatChipTone, { background: string; foreground: string }> = {
  blue: { background: "var(--mikke-blue, #3f4eb5)", foreground: "#ffffff" },
  orange: { background: "var(--mikke-orange, #f75a3b)", foreground: "#ffffff" },
  green: { background: "var(--mikke-green, #8bc7ad)", foreground: "#1b1b1f" },
  yellow: { background: "var(--mikke-yellow, #ffd370)", foreground: "#1b1b1f" },
  pink: { background: "var(--mikke-pink, #f9d3d2)", foreground: "#1b1b1f" }
};

const registeredAppTileTones: Partial<Record<string, StatChipTone>> = {
  MarketNote: "orange",
  Story: "blue",
  Community: "yellow",
  "Team Works": "green",
  Library: "blue"
};

const unregisteredTileStyle = {
  background: "var(--mikke-surface-soft, #f7f7f8)",
  foreground: "var(--mikke-text, #1b1b1f)"
};

/**
 * APPSタイルグリッド。モバイルドロワーは4列、PC常時サイドバーは2列。
 * アプリ色は登録済みテーマまたは明示されたtoneを使い、並び順では変えない。
 */
export function MikkeAppsTileGrid({ apps }: { apps: MikkeOwnerMenuItem[] }) {
  if (apps.length === 0) return null;
  return (
    <div className="grid grid-cols-4 gap-2 min-[900px]:grid-cols-2">
      {apps.map((app) => {
        const Icon = app.icon ?? Grid3X3;
        const tone = registeredAppTileTones[app.title] ?? app.tone;
        const style = tone ? tileToneStyles[tone] : unregisteredTileStyle;
        return (
          <Link
            key={`${app.title}-${app.href}`}
            href={app.href}
            className="flex h-[74px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl p-2.5 text-center"
            style={{ background: style.background }}
          >
            <Icon size={20} color={style.foreground} strokeWidth={1.8} />
            <span className="line-clamp-2 min-h-7 w-full overflow-hidden text-[10px] font-bold leading-3.5" style={{ color: style.foreground }}>
              {app.title}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * 本人メニュー（ハンバーガードロワー）: 軽量版。
 * ①この画面の機能=アイコン+文字1行(箱なし・説明なし) ②APPS=カラフル小アイコンタイルのグリッド
 * ③「＋アプリをつなげる」1行折りたたみ。全アプリ共通（STORY含む）。
 */
export function MikkeOwnerMenu({
  appName,
  theme = "blue",
  editItems = defaultEditItems,
  ownedApps = defaultOwnedApps,
  otherApps = [],
  suggestedApps = defaultSuggestedApps,
  mikkeId,
  isGuest = false,
  onSignOut,
  headerAction,
  onClose
}: MikkeOwnerMenuProps) {
  const themeStyle = tileToneStyles[theme];
  const appTiles = [...ownedApps, ...otherApps];

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: themeStyle.background }}>
            <Grid3X3 size={16} color={themeStyle.foreground} />
          </span>
          <p className="truncate text-sm font-bold tracking-normal">{appName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerAction}
          {onClose ? (
            <button
              type="button"
              aria-label="メニューを閉じる"
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--mikke-muted)]"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
      </div>

      {editItems.length > 0 ? (
        <div className="flex flex-col">
          {editItems.map((item) => {
            const Icon = item.icon ?? LinkIcon;
            return (
              <Link
                key={`${item.title}-${item.href}`}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-1 py-2.5 text-sm font-bold hover:bg-[var(--mikke-surface-soft)]"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: themeStyle.background }}>
                  <Icon size={16} color={themeStyle.foreground} />
                </span>
                {item.title}
              </Link>
            );
          })}
        </div>
      ) : null}

      {appTiles.length > 0 ? (
        <div>
          <p
            className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--mikke-muted)]"
            style={{ fontFamily: "var(--mikke-font-display)" }}
          >
            APPS
          </p>
          <MikkeAppsTileGrid apps={appTiles} />
        </div>
      ) : null}

      {suggestedApps.length > 0 ? <ConnectAppsSection apps={suggestedApps} /> : null}

      <MikkeAccountMenu mikkeId={mikkeId} isGuest={isGuest} onSignOut={onSignOut} />
    </section>
  );
}

export function MikkeAccountMenu({
  mikkeId,
  isGuest = false,
  onSignOut
}: Pick<MikkeOwnerMenuProps, "mikkeId" | "isGuest" | "onSignOut">) {
  const [copied, setCopied] = useState(false);
  const normalizedId = mikkeId?.replace(/^@/, "");

  async function copyMikkeId() {
    if (!normalizedId) return;
    try {
      await navigator.clipboard.writeText(`@${normalizedId}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  if (isGuest) {
    return (
      <div className="border-t border-[var(--mikke-line-soft)] pt-4">
        <p className="text-xs font-semibold leading-5 text-[var(--mikke-muted)]">
          ログインすると、別の端末でも<br />続きが見られます。
        </p>
        <Link
          href="/login?next=/marketnote"
          className="mt-3 flex min-h-10 w-full items-center justify-center rounded-lg bg-[var(--mikke-orange)] px-3 text-sm font-bold text-white"
        >
          ログイン・無料登録
        </Link>
      </div>
    );
  }

  if (!normalizedId && !onSignOut) return null;

  return (
    <div className="border-t border-[var(--mikke-line-soft)] pt-4">
      {normalizedId ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--mikke-muted-light)]">mikke ID</p>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--mikke-text)]">@{normalizedId}</p>
            <button
              type="button"
              onClick={() => void copyMikkeId()}
              className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-[var(--mikke-line)] px-2 text-xs font-bold text-[var(--mikke-muted)]"
              aria-label="mikke IDをコピー"
            >
              <Copy size={13} strokeWidth={1.8} />
              {copied ? "コピー済み" : "コピー"}
            </button>
          </div>
        </div>
      ) : null}

      {onSignOut ? (
        <button
          type="button"
          onClick={onSignOut}
          className={`${normalizedId ? "mt-4 border-t" : ""} flex w-full items-center gap-2 border-[var(--mikke-line-soft)] pt-4 text-left text-sm font-bold text-[var(--mikke-muted)]`}
        >
          <LogOut size={17} strokeWidth={1.8} />
          ログアウト
        </button>
      ) : null}
    </div>
  );
}

function ConnectAppsSection({ apps }: { apps: MikkeOwnerMenuSuggestedApp[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-[var(--mikke-line-soft)] pt-3">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 text-sm font-bold text-[var(--mikke-muted)]"
      >
        <PlusCircle size={18} />
        アプリをつなげる
        <ChevronDown size={16} className={`ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded ? (
        <div className="mt-2 flex flex-col gap-1">
          {apps.map((app) => {
            const content = (
              <span className="min-w-0">
                <span className="block text-sm font-bold">{app.name}</span>
                <span className="block truncate text-xs font-semibold text-[var(--mikke-muted)]">{app.helper}</span>
              </span>
            );
            return app.href ? (
              <Link key={app.name} href={app.href} className="rounded-lg px-1 py-2 hover:bg-[var(--mikke-surface-soft)]">
                {content}
              </Link>
            ) : (
              <div key={app.name} className="rounded-lg px-1 py-2">
                {content}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
