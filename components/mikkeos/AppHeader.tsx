"use client";

import { Menu, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type AppHeaderAction = {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
};

type AppHeaderProps = {
  /** 英大文字見出し（例: "STORY"）。中央に完全配置される。 */
  title: string;
  /** 左のハンバーガーを開く処理。mikkeOS全体でメニューは左に統一。 */
  onMenuClick?: () => void;
  menuOpen?: boolean;
  /** PC常時左サイドメニューを持つアプリ用: ≥900pxではサイドバーがナビを担うためハンバーガーを隠す（タイトル中央固定のグリッドは変えない）。 */
  hideMenuOnDesktop?: boolean;
  /** 右側の追加アイコン（共有・通知など）。最大2〜3個を想定。 */
  actions?: AppHeaderAction[];
  rightSlot?: ReactNode;
};

/**
 * mikkeOS共通ヘッダー: 左=ハンバーガー／中央=英大文字タイトル／右=アイコン群。
 * 1fr auto 1fr の3分割グリッドでタイトルを完全中央に固定する。
 */
export function AppHeader({ title, onMenuClick, menuOpen = false, hideMenuOnDesktop = false, actions = [], rightSlot }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--mikke-line)] bg-white/95 px-4 py-3 backdrop-blur">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="justify-self-start">
          {onMenuClick ? (
            <button
              type="button"
              aria-label="メニューを開く"
              aria-expanded={menuOpen}
              onClick={onMenuClick}
              className={`grid h-10 w-10 place-items-center rounded-lg text-[var(--mikke-text)] ${
                hideMenuOnDesktop ? "min-[900px]:hidden" : ""
              }`}
            >
              <Menu size={22} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>

        <p
          className="justify-self-center text-center text-[15px] font-bold uppercase text-[var(--mikke-primary)]"
          style={{ fontFamily: "var(--mikke-font-display)", letterSpacing: "0.32em" }}
        >
          {title}
        </p>

        <div className="flex items-center justify-self-end gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                aria-label={action.label}
                onClick={action.onClick}
                className="grid h-9 w-9 place-items-center text-[var(--mikke-text)]"
              >
                <Icon size={20} strokeWidth={1.8} />
              </button>
            );
          })}
          {rightSlot}
        </div>
      </div>
    </header>
  );
}
