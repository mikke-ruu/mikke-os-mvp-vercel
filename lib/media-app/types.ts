export type { MikkeContentBlock as MediaBlock, MikkeContentBlockType as MediaBlockType } from "@/lib/mikkeos/content/types";
import type { MikkeContentBlock as MediaBlock } from "@/lib/mikkeos/content/types";

export type MediaArticleSnapshot = {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  categories?: string[];
  coverImageUrl: string;
  blocks: MediaBlock[];
  publishedAt: string;
  updatedAt: string;
};

export type MediaArticle = {
  pinned?: boolean;
  publicationOrder?: number;
  displayDate?: string;
  id: string;
  mediaId: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  categories?: string[];
  coverImageUrl: string;
  coverImageAssetId?: string;
  blocks: MediaBlock[];
  status: "draft" | "published" | "unpublished";
  publishedSnapshot: MediaArticleSnapshot | null;
  createdAt: string;
  updatedAt: string;
};

export type MediaSite = {
  bannerImageUrl?: string;
  bannerPosition?: number;
  logoImageUrl?: string;
  authorAvatarUrl?: string;
  storyReference?: string;
  storyLinkRequested?: boolean;
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
