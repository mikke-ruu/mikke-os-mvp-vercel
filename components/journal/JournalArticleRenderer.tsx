import type { JournalArticle, JournalBlock } from "@/lib/hq-articles";
import { isSafeJournalUrl } from "@/lib/hq-articles";

function SafeAction({ href, className, children }: { href?: string; className: string; children: React.ReactNode }) {
  if (!href || !isSafeJournalUrl(href)) return null;
  const external = href.startsWith("http");
  return <a href={href} className={className} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{children}</a>;
}

function RenderBlock({ block }: { block: JournalBlock }) {
  switch (block.type) {
    case "heading": {
      const className = block.level === 3 ? "mt-10 text-xl font-black text-[var(--mikke-ink)]" : "mt-12 text-2xl font-black text-[var(--mikke-ink)] sm:text-3xl";
      return block.level === 3 ? <h3 className={className}>{block.text}</h3> : <h2 className={className}>{block.text}</h2>;
    }
    case "image":
      return block.imageUrl ? <figure className="my-9"><img src={block.imageUrl} alt={block.alt ?? ""} className="max-h-[680px] w-full rounded-2xl object-contain" />{block.caption ? <figcaption className="mt-2 text-center text-xs leading-5 text-[var(--mikke-muted)]">{block.caption}</figcaption> : null}</figure> : null;
    case "quote":
      return <blockquote className="my-8 border-l-4 border-[var(--mikke-primary)] bg-[var(--mikke-primary-soft)] px-5 py-5 text-base font-semibold leading-8 text-[var(--mikke-ink)]"><p className="whitespace-pre-wrap">{block.text}</p>{block.attribution ? <cite className="mt-3 block text-xs not-italic text-[var(--mikke-muted)]">— {block.attribution}</cite> : null}</blockquote>;
    case "list":
      return <ul className="my-6 list-disc space-y-2 pl-6 text-base leading-8 text-[var(--mikke-text)]">{(block.items ?? []).filter(Boolean).map((item, index) => <li key={`${block.id}_${index}`}>{item}</li>)}</ul>;
    case "divider":
      return <hr className="my-10 border-0 border-t border-[var(--mikke-line)]" />;
    case "link-card":
      return <SafeAction href={block.url} className="my-7 block rounded-2xl border border-[var(--mikke-line)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--mikke-primary)] hover:shadow-md"><span className="text-xs font-black tracking-[0.12em] text-[var(--mikke-primary)]">RELATED LINK</span><strong className="mt-2 block text-lg text-[var(--mikke-ink)]">{block.title || block.url}</strong>{block.description ? <span className="mt-2 block text-sm leading-6 text-[var(--mikke-muted)]">{block.description}</span> : null}</SafeAction>;
    case "cta":
      return <div className="my-9 text-center"><SafeAction href={block.url} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--mikke-primary)] px-6 py-3 text-sm font-black text-white shadow-sm">{block.label || "詳しく見る"}</SafeAction></div>;
    default:
      return <p className="my-5 whitespace-pre-wrap text-base leading-8 text-[var(--mikke-text)] sm:text-[17px]">{block.text}</p>;
  }
}

export function JournalArticleRenderer({ article, preview = false }: { article: JournalArticle; preview?: boolean }) {
  return (
    <article className="mx-auto w-full max-w-3xl">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--mikke-muted)]">
          {preview ? <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">下書きプレビュー</span> : null}
          {article.category ? <span className="rounded-full px-3 py-1 text-white" style={{ backgroundColor: article.category.color }}>{article.category.name}</span> : null}
          <time dateTime={article.published_at ?? article.updated_at}>{new Date(article.published_at ?? article.updated_at).toLocaleDateString("ja-JP")}</time>
        </div>
        <h1 className="mt-5 text-3xl font-black leading-tight text-[var(--mikke-ink)] sm:text-5xl">{article.title}</h1>
        {article.excerpt ? <p className="mt-5 text-base leading-8 text-[var(--mikke-muted)] sm:text-lg">{article.excerpt}</p> : null}
        {article.cover_image_url ? <img src={article.cover_image_url} alt="" className="mt-8 max-h-[680px] w-full rounded-3xl object-cover" /> : null}
      </header>
      <div className="mt-10">{article.blocks.map((block) => <RenderBlock key={block.id} block={block} />)}</div>
      {article.cta_label && article.cta_url ? <div className="mt-12 rounded-3xl bg-[var(--mikke-primary-soft)] p-6 text-center sm:p-8"><p className="text-xs font-black tracking-[0.15em] text-[var(--mikke-primary)]">NEXT STEP</p><SafeAction href={article.cta_url} className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--mikke-primary)] px-6 py-3 text-sm font-black text-white">{article.cta_label}</SafeAction></div> : null}
    </article>
  );
}
