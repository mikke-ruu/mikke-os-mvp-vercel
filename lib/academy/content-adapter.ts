import type { AcademyPageBlock, AcademyLpBlock } from "@/types/database";
import type { MikkeContentBlock } from "@/lib/mikkeos/content/types";

// Only presentation crosses this boundary. Never put materials or viewer rights in content.
export function academyContent(blocks: AcademyPageBlock[]): MikkeContentBlock[] {
  return blocks.filter(b => b.type !== "materials-list").map((b, index) => {
    if (b.contentVersion === 1 && b.content) return structuredClone(b.content);
    const id = `academy-legacy-${index}`;
    switch (b.type) {
      case "heading": return { id, type: "heading", level: 2, text: b.text };
      case "text": return { id, type: "paragraph", text: b.text };
      case "image": return { id, type: "image", imageUrl: b.url, caption: b.caption, alt: b.caption, imageLink: b.linkUrl };
      case "video": return { id, type: "video", url: b.url, title: b.caption };
      case "links": return { id, type: "links", title: b.title, links: structuredClone(b.items) };
      case "image-text": return { id, type: "image-text", imageUrl: b.imageUrl, imageLink: b.linkUrl, title: b.heading, text: b.text };
      case "gallery": return { id, type: "gallery", columns: 3, images: b.images.map(i => ({url:i.url,alt:i.caption ?? "",caption:i.caption,href:i.linkUrl})) };
      case "cta": return { id, type: "cta", title: b.heading, buttonLabel: b.buttonLabel, url: b.buttonUrl };
      default: throw new Error("この種類の内容は共通エディターでは編集できません。");
    }
  });
}

// Retain a legacy projection alongside the full common payload. JSON round trips keep
// formatting, stable IDs and layouts; there is no bulk migration or automatic publish.
export function contentToAcademy(blocks: MikkeContentBlock[]): AcademyLpBlock[] {
  return blocks.map(content => {
    let legacy: AcademyLpBlock;
    switch (content.type) {
      case "heading": legacy = {type:"heading",text:content.text ?? ""}; break;
      case "image": legacy = {type:"image",url:content.imageUrl ?? "",caption:content.caption,linkUrl:content.imageLink}; break;
      case "image-text": legacy = {type:"image-text",imageUrl:content.imageUrl ?? "",heading:content.title,text:content.text ?? "",linkUrl:content.imageLink}; break;
      case "gallery": legacy = {type:"gallery",images:(content.images ?? []).map(i=>({url:i.url,caption:i.caption,linkUrl:i.href}))}; break;
      case "cta": legacy = {type:"cta",heading:content.title ?? "",buttonLabel:content.buttonLabel ?? "",buttonUrl:content.url ?? ""}; break;
      case "list": legacy = {type:"text",text:(content.items ?? []).map(t=>`• ${t}`).join("\n")}; break;
      case "links": legacy = {type:"text",text:[content.title,...(content.links ?? []).map(i=>`${i.label} ${i.url}`)].filter(Boolean).join("\n")}; break;
      case "video": case "link": legacy = {type:"text",text:[content.title,content.url].filter(Boolean).join("\n")}; break;
      case "divider": legacy = {type:"text",text:"—"}; break;
      default: legacy = {type:"text",text:content.text ?? ""};
    }
    return {...legacy,contentVersion:1,content:structuredClone(content)};
  });
}

export function replaceAcademyContent(original: AcademyPageBlock[], content: MikkeContentBlock[]): AcademyPageBlock[] {
  const next: AcademyPageBlock[] = contentToAcademy(content).map((legacy,index) => {
    const b = content[index];
    if (b.type === "video") return {type:"video",url:b.url ?? "",caption:b.title,contentVersion:1,content:structuredClone(b)};
    if (b.type === "links") return {type:"links",title:b.title,items:structuredClone(b.links ?? []),contentVersion:1,content:structuredClone(b)};
    return legacy;
  });
  // Preserve legacy permission-bound placeholders without exposing them in insert menus.
  original.forEach((block,index)=>{if(block.type === "materials-list") next.splice(Math.min(index,next.length),0,structuredClone(block));});
  return next;
}
