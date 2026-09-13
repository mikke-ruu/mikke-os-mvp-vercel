import type {AcademyPageBlock} from "@/types/database";
import type {MikkeContentBlock} from "./types";
// Explicit conversion of presentation only; no enrollment, materials or ownership transfer.
export function academyToContentBlocks(blocks:AcademyPageBlock[]):MikkeContentBlock[] {
  return blocks.map(block=>{const id=crypto.randomUUID();
    switch(block.type){
      case "heading":return {id,type:"heading",level:2,text:block.text};
      case "text":return {id,type:"paragraph",text:block.text};
      case "image":return {id,type:"image",imageUrl:block.url,caption:block.caption,alt:block.caption??""};
      case "video":return {id,type:"video",url:block.url,title:block.caption};
      case "links":return {id,type:"links",title:block.title,links:structuredClone(block.items)};
      case "image-text":return {id,type:"image-text",imageUrl:block.imageUrl,title:block.heading,text:block.text};
      case "gallery":return {id,type:"gallery",columns:3,images:block.images.map(image=>({url:image.url,alt:image.caption??"",caption:image.caption}))};
      case "cta":return {id,type:"cta",title:block.heading,buttonLabel:block.buttonLabel,url:block.buttonUrl};
      case "materials-list":throw Error("教材一覧はAcademyの権限付き表示が必要です。共通ページへ変換できません。");
    }
  });
}
