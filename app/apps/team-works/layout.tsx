import type { CSSProperties, ReactNode } from "react";

/**
 * Team Works配色。正典 `docs/MIKKEOS_EDITORIAL_UI_DESIGN_RULES.md` に従う。
 *
 * ブランド5色は薄めない・濃くしない・濁らせない・派生色を作らない。
 * 色は装飾ではなく意味で決める:
 *   BLUE=タイトル/現在地・選択状態、ORANGE=主要操作/未対応、
 *   GREEN=完了/実施済、YELLOW=予定/これから、PINK=締切/補助。
 *
 * 2026-07-29: 以前ここにあった
 *   `bg-[var(--mikke-primary)]` / `bg-[var(--mikke-accent)]` → #8bc7ad 強制上書き
 * を撤去した。青（現在地）とオレンジ（主要操作）の両方を緑に潰していたため、
 * 画面全体が緑一色になり、他の色が「薄く添えるだけ」になっていた原因。
 */
const teamWorksTheme = {
  // ブランド5色（第一級トークン・加工禁止）
  "--mikke-blue": "#3f4eb5",
  "--mikke-green": "#8bc7ad",
  "--mikke-pink": "#f9d3d2",
  "--mikke-yellow": "#ffd370",
  "--mikke-orange": "#f75a3b",

  // 役割トークン。新規実装・改修はこちらを使う。
  // 5色をそのまま割り当てているので、薄める余地がない。
  "--tw-title": "#3f4eb5",
  "--tw-action": "#f75a3b",
  "--tw-done": "#8bc7ad",
  "--tw-planned": "#ffd370",
  "--tw-deadline": "#f9d3d2",
  // 淡色(green/yellow/pink)の上は黒、濃色(blue/orange)の上は白。
  "--tw-on-tint": "#1b1b1f",
  "--tw-on-solid": "#ffffff",

  // 既存 --mikke-* の再マップ。広い面は無彩色に寄せ、
  // 色は状態表示・主要操作といった小さな面へ集中させる（正典2章）。
  "--mikke-primary": "#3f4eb5",
  "--mikke-primary-soft": "#f8fafc",
  "--mikke-primary-border": "#e6e6e6",
  "--mikke-accent": "#f75a3b",
  "--mikke-accent-strong": "#f75a3b",
  "--mikke-accent-soft": "#f9d3d2",
  "--mikke-success": "#1b1b1f",
  "--mikke-success-soft": "#8bc7ad",
  "--mikke-danger": "#f75a3b"
} as CSSProperties;

export default function TeamWorksLayout({ children }: { children: ReactNode }) {
  return (
    <div data-team-works-theme style={teamWorksTheme}>
      {children}
    </div>
  );
}
