import type { MikkeContentBlock as MediaBlock } from "./types";
export function sliceMediaRichText(block:MediaBlock,start:number,end:number) {
  let offset=0;return (block.richText??[{text:block.text??""}]).flatMap(run=>{const from=Math.max(0,start-offset),to=Math.min(run.text.length,end-offset);offset+=run.text.length;return to>from?[{...run,text:run.text.slice(from,to)}]:[];});
}
