import type { MikkeContentBlock } from "../mikkeos/content/types";

export type MediaPublicBlockDTO = Omit<MikkeContentBlock, "imageAssetId" | "images"> & {
  images?: { url: string; alt: string; caption?: string; href?: string }[];
};
const keys: Record<string, string[]> = {
  paragraph: ["id", "type", "text", "richText", "align"],
  heading: ["id", "type", "text", "level", "richText", "align"],
  image: ["id", "type", "imageUrl", "alt", "caption", "imageLink"],
  quote: ["id", "type", "text", "attribution", "richText", "align"],
  list: ["id", "type", "items"], divider: ["id", "type"],
  link: ["id", "type", "url", "title", "text", "imageUrl"],
  video: ["id", "type", "url", "title", "text", "imageUrl"],
  links: ["id", "type", "title", "links"],
  "image-text": ["id", "type", "imageUrl", "alt", "imageLink", "imageSide", "title", "text"],
  gallery: ["id", "type", "images", "columns"],
  cta: ["id", "type", "title", "text", "buttonLabel", "url"]
};
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const str = (value: unknown, max: number) => typeof value === "string" && value.length <= max;
const only = (value: Record<string, unknown>, fields: string[]) => Object.keys(value).every(key => fields.includes(key));
export function safeContentUrl(value: unknown): value is string {
  if (!str(value, 2048) || /[\s\\]/.test(value as string)) return false;
  if (value === "" || /^\/(?!\/)/.test(value as string)) return true;
  try { const url = new URL(value as string); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
const tokenImage = (value: unknown) => typeof value === "string" && /^\/media\/images\/[a-f0-9]{64}$/.test(value);
export function externalCardImage(value: unknown) {
  if (!safeContentUrl(value) || !value.startsWith("https://")) return false;
  try { const url = new URL(value); return url.hostname.includes(".") && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname) && !/\.(local|localhost|internal)$/.test(url.hostname); } catch { return false; }
}
export function validPublicBlock(value: unknown): value is MediaPublicBlockDTO {
  if (!object(value) || !str(value.id, 80) || !(value.id as string).length || typeof value.type !== "string" || !keys[value.type] || !only(value, keys[value.type])) return false;
  const type = value.type;
  for (const [key, max] of Object.entries({ text: type === "heading" ? 500 : 20000, title: 500, alt: 500, caption: 1000, attribution: 500, buttonLabel: 120 })) {
    if (key in value && !str(value[key], max)) return false;
  }
  for (const key of ["url", "imageLink"]) if (key in value && !safeContentUrl(value[key])) return false;
  if ("align" in value && !["left", "center", "right"].includes(value.align as string)) return false;
  if ("richText" in value) {
    if (!Array.isArray(value.richText) || value.richText.length > 5000) return false;
    if (!value.richText.every(run => object(run) && only(run, ["text", "bold", "strike", "href"]) && str(run.text, 20000) && (!["bold", "strike"].some(key => key in run && typeof run[key] !== "boolean")) && (!("href" in run) || safeContentUrl(run.href)))) return false;
    if (value.richText.map(run => run.text).join("") !== value.text) return false;
  }
  if (["paragraph", "heading", "quote", "image-text", "cta"].includes(type) && typeof value.text !== "string") return false;
  if (type === "heading" && value.level !== 2 && value.level !== 3) return false;
  if (["image", "image-text"].includes(type) && (!tokenImage(value.imageUrl) || !str(value.alt, 500))) return false;
  if (type === "image-text" && "imageSide" in value && !["left", "right"].includes(value.imageSide as string)) return false;
  if (["link", "video", "cta"].includes(type) && (!safeContentUrl(value.url) || !value.url)) return false;
  if (["link", "video"].includes(type) && "imageUrl" in value && value.imageUrl !== "" && !tokenImage(value.imageUrl) && !externalCardImage(value.imageUrl)) return false;
  if (type === "list" && (!Array.isArray(value.items) || value.items.length > 100 || !value.items.every(item => str(item, 2000)))) return false;
  if (type === "links" && (!Array.isArray(value.links) || value.links.length > 100 || !value.links.every(link => object(link) && only(link, ["label", "url"]) && str(link.label, 500) && safeContentUrl(link.url) && link.url))) return false;
  if (type === "gallery") {
    if ("columns" in value && value.columns !== 2 && value.columns !== 3) return false;
    if (!Array.isArray(value.images) || value.images.length > 50 || !value.images.every(image => object(image) && only(image, ["url", "alt", "caption", "href"]) && tokenImage(image.url) && str(image.alt, 500) && (!("caption" in image) || str(image.caption, 1000)) && (!("href" in image) || safeContentUrl(image.href)))) return false;
  }
  return true;
}
