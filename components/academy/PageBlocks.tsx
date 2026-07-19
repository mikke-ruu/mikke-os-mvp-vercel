import { ExternalLink, FileText, Link2, Video } from "lucide-react";
import type { AcademyMaterial, AcademyPageBlock } from "@/types/database";

function kindIcon(kind: AcademyMaterial["kind"]) {
  if (kind === "video") return <Video size={14} className="shrink-0 text-[var(--mikke-accent-strong)]" />;
  if (kind === "link") return <Link2 size={14} className="shrink-0 text-[var(--mikke-accent-strong)]" />;
  return <FileText size={14} className="shrink-0 text-[var(--mikke-accent-strong)]" />;
}

// Wave C (AC-C3): ブロック配列に materials-list ブロックが含まれるかどうかの判定。
// 呼び出し側（app/academy/portal/study）が、旧データ（ブロック未設置）の場合だけ
// 教材一覧をページ末尾に補足表示する、という互換動作を作るために使う。
export function pageBlocksHasMaterialsList(blocks: AcademyPageBlock[] | undefined) {
  return (blocks ?? []).some((b) => b.type === "materials-list");
}

// 講師専用ページのビルド式ブロックを表示する共通ビュー。
// materials: materials-list ブロックがある場合にそこへ差し込む、この講座の公開教材一覧
// （呼び出し側が listMaterialsForInstructor 等で取得済みのものを渡す）。
export function PageBlocks({ blocks, materials = [] }: { blocks: AcademyPageBlock[]; materials?: AcademyMaterial[] }) {
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

        if (b.type === "image-text")
          return (
            <div key={i} className="grid gap-3 sm:grid-cols-2 sm:items-center">
              {b.imageUrl ? <img src={b.imageUrl} alt="" className="w-full rounded-xl" /> : null}
              <div>
                {b.heading ? <h4 className="text-sm font-bold text-[var(--mikke-text)]">{b.heading}</h4> : null}
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--mikke-text)]">{b.text}</p>
              </div>
            </div>
          );

        if (b.type === "gallery")
          return b.images.length ? (
            <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {b.images.filter((img) => img.url).map((img, j) => (
                <figure key={j}>
                  <img src={img.url} alt={img.caption ?? ""} className="aspect-square w-full rounded-xl object-cover" />
                  {img.caption ? <figcaption className="mt-1 text-xs text-[var(--mikke-muted)]">{img.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          ) : null;

        if (b.type === "cta")
          return b.buttonUrl ? (
            <div key={i} className="rounded-xl bg-[var(--mikke-surface-soft)] p-4 text-center">
              {b.heading ? <p className="text-sm font-bold text-[var(--mikke-text)]">{b.heading}</p> : null}
              <a href={b.buttonUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-full bg-[var(--mikke-accent)] px-5 py-2.5 text-sm font-bold text-white">
                {b.buttonLabel || "詳しく見る"}
              </a>
            </div>
          ) : null;

        if (b.type === "materials-list")
          return materials.length ? (
            <div key={i}>
              <p className="mb-1 text-xs font-bold text-[var(--mikke-accent)]">教材・資料</p>
              <ul className="grid gap-1.5 md:grid-cols-2">
                {materials.map((m) => (
                  <li key={m.id}>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-xl border border-[var(--mikke-line)] bg-white px-3 py-2 text-sm text-[var(--mikke-text)]"
                    >
                      {kindIcon(m.kind)}
                      <span className="min-w-0 flex-1 truncate">{m.title}</span>
                      <ExternalLink size={12} className="shrink-0 text-[var(--mikke-muted)]" />
                    </a>
                  </li>
                ))}
              </ul>
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
