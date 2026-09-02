import type { MediaPublicArticleDTO, MediaPublicSiteDTO, MediaPublicTransport } from "@/lib/media-app/public-contract";

const previewSite: MediaPublicSiteDTO = {
  name: "mikkeOS Media 開発確認",
  slug: "mikkeos-media-preview",
  description: "自分で書いた記事を、公開前に確認するための開発用Mediaです。",
  authorName: "mikkeOS編集部",
  locale: "ja-JP",
  categories: ["お知らせ"]
};

const previewArticle: MediaPublicArticleDTO = {
  title: "Media Freeの公開画面を確認しています",
  slug: "media-free-preview",
  excerpt: "公開用DTOだけで、媒体ページと記事ページを表示する開発確認です。",
  categoryName: "お知らせ",
  coverImageUrl: "",
  locale: "ja-JP",
  versionNumber: 1,
  revisionHash: "a".repeat(64),
  publishedAt: "2026-09-03T00:00:00.000Z",
  updatedAt: "2026-09-03T00:00:00.000Z",
  blocks: [
    { id: "intro", type: "paragraph", text: "Mediaでは、自分で記事を書き、内容を確認してから公開できます。" },
    { id: "heading", type: "heading", level: 2, text: "公開前に人が確認します" },
    { id: "body", type: "paragraph", text: "AIや外部サービスをつなぐ場合も、下書きから始めます。" }
  ]
};

export const fakeMediaPublicTransport: MediaPublicTransport = {
  async readSite(mediaSlug) {
    return mediaSlug === previewSite.slug ? previewSite : null;
  },
  async readArticles(mediaSlug) {
    return mediaSlug === previewSite.slug ? [{ ...previewArticle, blocks: undefined }].map(({ blocks: _blocks, ...article }) => article) : [];
  },
  async readArticle(mediaSlug, articleSlug) {
    return mediaSlug === previewSite.slug && articleSlug === previewArticle.slug ? previewArticle : null;
  }
};
