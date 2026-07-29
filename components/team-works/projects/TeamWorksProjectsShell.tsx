// このファイルはかつて納品型プロジェクト系画面専用の外枠(サイドバー無し・
// 「継続業務/プロジェクト/テンプレート」3タブ)を提供していたが、2026-07-30の
// 統一計画により廃止した。本部側の全画面は TeamWorksOperationsShell
// (components/team-works/operations/TeamWorksOperationsShell.tsx)の
// 左サイドバーに一本化している。
//
// teamWorksProjectInputClass / TeamWorksProjectField は納品型の各画面が
// 広く import しているため、このファイルにそのまま残す。

export const teamWorksProjectInputClass =
  "mt-1.5 w-full appearance-none rounded-lg border border-[var(--mikke-line)] bg-[var(--mikke-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--mikke-accent)]";

export function TeamWorksProjectField({
  label,
  required = false,
  helper,
  className = "",
  children
}: {
  label: string;
  required?: boolean;
  helper?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-bold text-[var(--mikke-text)]">
        {label}
        {required ? <span className="ml-1 text-[var(--mikke-accent)]">*</span> : null}
      </span>
      {children}
      {helper ? <span className="mt-1 block text-xs leading-5 text-[var(--mikke-muted)]">{helper}</span> : null}
    </label>
  );
}
