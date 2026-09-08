export type MediaBlockType = "paragraph" | "heading" | "image" | "quote" | "list" | "divider" | "link";

export type MediaBlock = {
  id: string;
  type: MediaBlockType;
  text?: string;
  level?: 2 | 3;
  imageUrl?: string;
  imageAssetId?: string;
  alt?: string;
  caption?: string;
  attribution?: string;
  items?: string[];
  title?: string;
  url?: string;
};

export type MediaArticleSnapshot = {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  coverImageUrl: string;
  blocks: MediaBlock[];
  publishedAt: string;
  updatedAt: string;
};

export type MediaArticle = {
  id: string;
  mediaId: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  coverImageUrl: string;
  coverImageAssetId?: string;
  blocks: MediaBlock[];
  status: "draft" | "published" | "unpublished";
  publishedSnapshot: MediaArticleSnapshot | null;
  createdAt: string;
  updatedAt: string;
};

export type MediaSite = {
  id: string;
  ownerProfileId: string;
  name: string;
  slug: string;
  description: string;
  authorName: string;
  authorBio?: string;
  storyUrl?: string;
  showStory?: boolean;
  categories: string[];
  createdAt: string;
  updatedAt: string;
};

export type MediaStoreState = {
  version: 1;
  sites: MediaSite[];
  articles: MediaArticle[];
};
