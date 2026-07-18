import type { AppKey } from "@/lib/mikkeos/types";

export type PageSiteStatus = "draft" | "paused";
export type PageDocumentStatus = "draft" | "hidden";
export type PageBlockType = "heading" | "text" | "image" | "button" | "divider" | "cms";
export type PageCmsSource = "story" | Extract<AppKey, "item_studio" | "event" | "academy" | "session">;
export type PageCmsDisplayMode = "list" | "cards" | "featured";

export type PageBlockBase = {
  id: string;
  type: PageBlockType;
  order: number;
};

export type PageHeadingBlock = PageBlockBase & {
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
};

export type PageTextBlock = PageBlockBase & {
  type: "text";
  text: string;
};

export type PageImageBlock = PageBlockBase & {
  type: "image";
  alt: string;
  imageUrl: string;
  caption?: string;
};

export type PageButtonBlock = PageBlockBase & {
  type: "button";
  label: string;
  href: string;
};

export type PageDividerBlock = PageBlockBase & {
  type: "divider";
};

export type PageCmsBlock = PageBlockBase & {
  type: "cms";
  source: PageCmsSource;
  displayMode: PageCmsDisplayMode;
  title: string;
  filters: {
    featuredOnly?: boolean;
    thisMonthOnly?: boolean;
    approvedOnly?: boolean;
  };
};

export type PageBlock =
  | PageHeadingBlock
  | PageTextBlock
  | PageImageBlock
  | PageButtonBlock
  | PageDividerBlock
  | PageCmsBlock;

export type PageDocument = {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  status: PageDocumentStatus;
  blocks: PageBlock[];
  createdAt: string;
  updatedAt: string;
};

export type PagePublicationDraft = {
  slug: string;
  isPublic: false;
  searchIndexEnabled: false;
};

export type PageSite = {
  id: string;
  ownerProfileId: string;
  name: string;
  description: string;
  status: PageSiteStatus;
  publication: PagePublicationDraft;
  documents: PageDocument[];
  createdAt: string;
  updatedAt: string;
};

export type PageStoreState = {
  version: 1;
  sites: PageSite[];
};
