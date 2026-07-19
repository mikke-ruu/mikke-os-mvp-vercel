import type { AppKey } from "@/lib/mikkeos/types";

export type PageSiteStatus = "draft" | "paused";
export type PageDocumentStatus = "draft" | "hidden";
export type PageDocumentMode = "builder" | "html";
export type PageCmsSource = "story" | Extract<AppKey, "item_studio" | "event" | "academy" | "session" | "order" | "fund" | "community">;
export type PageCmsDisplayMode = "list" | "cards" | "featured";
export type PageBlockType =
  | "heading"
  | "text"
  | "image"
  | "button"
  | "form"
  | "divider"
  | "cms"
  | "company"
  | "columns"
  | "gallery"
  | "slideshow"
  | "embed"
  | "html";

export type PageTextAlign = "left" | "center" | "right";
export type PageSpacing = "compact" | "normal" | "spacious";
export type PageRadius = "none" | "medium" | "large";
export type PageAnimation = "none" | "fade" | "fade-up" | "zoom" | "slide-left" | "slide-right";
export type PageFontPreset = "gothic" | "soft" | "serif" | "modern";

export type PageJpFontId =
  | "noto-sans"
  | "noto-serif"
  | "zen-kaku"
  | "zen-old"
  | "zen-maru"
  | "mplus-round"
  | "shippori"
  | "biz-ud";

export type PageLatinFontId =
  | "none"
  | "inter"
  | "montserrat"
  | "poppins"
  | "playfair"
  | "cormorant"
  | "dm-serif"
  | "josefin"
  | "caveat";

export type PageBlockStyle = {
  backgroundColor?: string;
  textColor?: string;
  textAlign?: PageTextAlign;
  spacing?: PageSpacing;
  radius?: PageRadius;
  animation?: PageAnimation;
  /** このブロックだけ見出し・本文フォントを上書きする（未指定ならサイト全体の設定を継承） */
  jpFontId?: PageJpFontId;
  latinFontId?: PageLatinFontId;
};

export type PageAssetRef = {
  mediaAssetId?: string;
  storagePath: string;
  publicUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
};

export type PageMediaItem = {
  id: string;
  imageUrl: string;
  asset?: PageAssetRef;
  alt: string;
  caption?: string;
};

export type PageBlockBase = {
  id: string;
  type: PageBlockType;
  order: number;
  hidden?: boolean;
  style?: PageBlockStyle;
};

export type PageHeadingBlock = PageBlockBase & {
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
};

export type PageTextBlock = PageBlockBase & {
  type: "text";
  text: string;
  size?: "small" | "normal" | "large";
};

export type PageImageBlock = PageBlockBase & {
  type: "image";
  alt: string;
  imageUrl: string;
  asset?: PageAssetRef;
  caption?: string;
  fit?: "cover" | "contain";
};

export type PageButtonBlock = PageBlockBase & {
  type: "button";
  label: string;
  href: string;
  variant?: "solid" | "outline" | "soft";
};

export type PageFormBlock = PageBlockBase & {
  type: "form";
  title: string;
  description: string;
  buttonLabel: string;
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
    selectedItemIds?: string[];
  };
};

export type PageCompanyRow = {
  id: string;
  label: string;
  value: string;
};

export type PageCompanyBlock = PageBlockBase & {
  type: "company";
  title: string;
  rows: PageCompanyRow[];
};

export type PageColumnItem = {
  id: string;
  eyebrow?: string;
  title: string;
  text: string;
  imageUrl: string;
  asset?: PageAssetRef;
  imageAlt?: string;
  buttonLabel?: string;
  href?: string;
};

export type PageColumnsBlock = PageBlockBase & {
  type: "columns";
  title?: string;
  ratio: "1-1" | "1-2" | "2-1" | "three";
  columns: PageColumnItem[];
};

export type PageGalleryBlock = PageBlockBase & {
  type: "gallery";
  title: string;
  columns: 2 | 3 | 4;
  images: PageMediaItem[];
};

export type PageSlideshowBlock = PageBlockBase & {
  type: "slideshow";
  title: string;
  images: PageMediaItem[];
  autoplay: boolean;
  intervalSeconds: 3 | 5 | 8;
};

export type PageEmbedBlock = PageBlockBase & {
  type: "embed";
  title?: string;
  url: string;
  embedHtml?: string;
  height: number;
};

export type PageHtmlBlock = PageBlockBase & {
  type: "html";
  title?: string;
  html: string;
  css: string;
  javascript: string;
  allowScripts: boolean;
  height: number;
};

export type PageBlock =
  | PageHeadingBlock
  | PageTextBlock
  | PageImageBlock
  | PageButtonBlock
  | PageFormBlock
  | PageDividerBlock
  | PageCmsBlock
  | PageCompanyBlock
  | PageColumnsBlock
  | PageGalleryBlock
  | PageSlideshowBlock
  | PageEmbedBlock
  | PageHtmlBlock;

export type PageHtmlDocument = {
  html: string;
  css: string;
  javascript: string;
  allowScripts: boolean;
  showSiteChrome: boolean;
};

export type PageDocument = {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  status: PageDocumentStatus;
  mode: PageDocumentMode;
  blocks: PageBlock[];
  htmlDocument: PageHtmlDocument;
  createdAt: string;
  updatedAt: string;
};

export type PagePublicationDraft = {
  slug: string;
  isPublic: false;
  searchIndexEnabled: false;
};

export type PageSiteTheme = {
  presetId: PageFontPreset;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  /** 旧仕様のフォント指定（文字列）。新しいheading/bodyのJp/LatinFontIdが未指定のときのフォールバック */
  headingFont: string;
  bodyFont: string;
  /** 新仕様: 日本語×欧文フォントの自由組合せ（省略時はheadingFont/bodyFontへフォールバック） */
  headingJpFontId?: PageJpFontId;
  headingLatinFontId?: PageLatinFontId;
  bodyJpFontId?: PageJpFontId;
  bodyLatinFontId?: PageLatinFontId;
  contentWidth: "narrow" | "standard" | "wide";
  buttonStyle: "rounded" | "pill" | "square";
};

export type PageSite = {
  id: string;
  ownerProfileId: string;
  name: string;
  description: string;
  status: PageSiteStatus;
  theme: PageSiteTheme;
  publication: PagePublicationDraft;
  documents: PageDocument[];
  createdAt: string;
  updatedAt: string;
};

export type PageStoreState = {
  version: 2;
  sites: PageSite[];
};
