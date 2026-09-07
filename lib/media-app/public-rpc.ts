import type { MediaPublicTransport } from "./public-contract";

type PublicRpcName = "media_public_site" | "media_public_articles" | "media_public_article";
export type MediaPublicRpcCaller = (
  name: PublicRpcName,
  args: Record<string, string | number | null>
) => PromiseLike<{ data: unknown; error: unknown }>;

const siteKeys = ["name", "slug", "description", "author_name", "locale", "categories"];
const articleKeys = ["title", "slug", "excerpt", "category_name", "cover_image_url", "blocks", "locale", "version_number", "revision_hash", "published_at", "updated_at"];

function row(value: unknown, keys: string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === keys.length && Object.keys(record).every((key) => keys.includes(key)) ? record : null;
}

function slug(value: string) {
  return value.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function locale(value: string | undefined) {
  return value === undefined || (value.length <= 16 && /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(value));
}

function projectArticle(value: unknown) {
  const item = row(value, articleKeys);
  if (!item || !Array.isArray(item.blocks)) return null;
  // The SQL public projection must remove asset bindings before transport.
  // Reject them here rather than hiding a direct-RPC disclosure defect.
  if (item.blocks.some((block) => !block || typeof block !== "object" || Array.isArray(block)
    || Object.keys(block).some((key) => ["imageAssetId", "owner_id", "site_id", "article_id", "draft_blocks"].includes(key)))) return null;
  return {
    title: item.title, slug: item.slug, excerpt: item.excerpt,
    categoryName: item.category_name, coverImageUrl: item.cover_image_url,
    blocks: item.blocks, locale: item.locale, versionNumber: item.version_number,
    revisionHash: item.revision_hash, publishedAt: item.published_at, updatedAt: item.updated_at
  };
}

// This factory does not create a client or select a database. The server must
// supply an approved anonymous public-RPC caller and wrap it in the DTO reader.
export function createMediaPublicRpcTransport(call: MediaPublicRpcCaller): MediaPublicTransport {
  async function request(name: PublicRpcName, args: Record<string, string | number | null>) {
    try {
      const result = await call(name, args);
      if (result.error) throw new Error("MEDIA_PUBLIC_RPC_FAILED");
      return result.data;
    } catch {
      throw new Error("MEDIA_PUBLIC_RPC_FAILED");
    }
  }
  return {
    async readSite(mediaSlug, requestedLocale) {
      if (!slug(mediaSlug) || !locale(requestedLocale)) return null;
      const data = await request("media_public_site", { p_slug: mediaSlug, p_locale: requestedLocale ?? null });
      if (!Array.isArray(data) || data.length !== 1) return null;
      const item = row(data[0], siteKeys);
      if (!item || item.slug !== mediaSlug || (requestedLocale && item.locale !== requestedLocale) || !Array.isArray(item.categories)) return null;
      const categories = item.categories.map((value) => row(value, ["name", "slug"]));
      if (categories.some((category) => !category || typeof category.slug !== "string" || !slug(category.slug))) return null;
      return { name: item.name, slug: item.slug, description: item.description, authorName: item.author_name,
        locale: item.locale, categories: categories.map((category) => category!.name) };
    },
    async readArticles(mediaSlug, requestedLocale) {
      if (!slug(mediaSlug) || !locale(requestedLocale)) return null;
      const data = await request("media_public_articles", { p_site_slug: mediaSlug, p_locale: requestedLocale ?? null, p_limit: 50 });
      if (!Array.isArray(data) || data.length > 50) return null;
      const articles = data.map(projectArticle);
      if (articles.some((article) => !article || (requestedLocale && article.locale !== requestedLocale))) return null;
      return articles.map((article) => {
        const { blocks: _blocks, ...summary } = article!;
        return summary;
      });
    },
    async readArticle(mediaSlug, articleSlug, requestedLocale) {
      if (!slug(mediaSlug) || !slug(articleSlug) || !locale(requestedLocale)) return null;
      const data = await request("media_public_article", { p_site_slug: mediaSlug, p_article_slug: articleSlug, p_locale: requestedLocale ?? null });
      if (!Array.isArray(data) || data.length !== 1) return null;
      const article = projectArticle(data[0]);
      return article && article.slug === articleSlug && (!requestedLocale || article.locale === requestedLocale) ? article : null;
    }
  };
}
