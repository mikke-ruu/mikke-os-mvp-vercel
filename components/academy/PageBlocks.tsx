import { ExternalLink } from "lucide-react";
import type { AcademyPageBlock } from "@/types/database";

// 講師専用ページのビルド式ブロックを表示する共通ビュー
export function PageBlocks({ blocks }: { blocks: AcademyPageBlock[] }) {
  if (!blocks?.length) return null;
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        if (b.type === "heading") return <h3 key={i} className="text-base font-bold text-[var(--mikke-text)]">{b.text}</h3>;
        if (b.type === "text") return <p key={i} className="whitespace-pre-wrap text-sm leading-6 text-[var(--mikke-text)]">{b.text}</p>;
        if (b.type === "image")
          return b.url ? (
            <figure key={i}>
              <img src={b.url} alt={b.caption ?? ""} className="w-full rounded-xl" />
              {b.caption ? <figcaption className="mt-1 text-xs text-[var(--mikke-muted)]">{b.caption}</figcaption> : null}
            </figure>
          ) : null;
        if (b.type === "video")
          return b.url ? (
            <div key={i}>
              <a href={b.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-3 py-2 text-sm font-bold text-[var(--mikke-text)]">
                <span className="min-w-0 flex-1 truncate">▶ {b.caption || "動画を見る"}</span>
                <ExternalLink size={12} className="shrink-0 text-[var(--mikke-muted)]" />
              </a>
            </div>
          ) : null;
        // links（リンク集）
        return (
          <div key={i}>
            {b.title ? <p className="mb-1 text-sm font-bold text-[var(--mikke-accent-strong)]">{b.title}</p> : null}
            <ul className="space-y-1">
              {b.items.filter((it) => it.url).map((it, j) => (
                <li key={j}>
                  <a href={it.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-[var(--mikke-surface-soft)] px-3 py-2 text-sm text-[var(--mikke-text)]">
                    <span className="min-w-0 flex-1 truncate">{it.label || it.url}</span>
                    <ExternalLink size={12} className="shrink-0 text-[var(--mikke-muted)]" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
