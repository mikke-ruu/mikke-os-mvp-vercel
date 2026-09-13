export type MikkeContentBlockType = "paragraph" | "heading" | "image" | "quote" | "list" | "divider" | "link" | "video" | "links" | "image-text" | "gallery" | "cta";

export type MikkeContentBlock = {
  id: string;
  type: MikkeContentBlockType;
  text?: string;
  align?: "left" | "center" | "right";
  richText?: { text: string; bold?: boolean; strike?: boolean; href?: string }[];
  level?: 2 | 3;
  imageUrl?: string;
  imageAssetId?: string;
  imageLink?: string;
  alt?: string;
  caption?: string;
  attribution?: string;
  items?: string[];
  title?: string;
  url?: string;
  links?: {label:string;url:string}[];
  images?: {url:string;alt:string;caption?:string;href?:string}[];
  imageSide?: "left" | "right";
  columns?: 2 | 3;
  buttonLabel?: string;
};
