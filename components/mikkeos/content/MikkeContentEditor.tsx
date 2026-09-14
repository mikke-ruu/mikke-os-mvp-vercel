"use client";
import {Fragment,useEffect,useRef,type ReactNode} from "react";
import {ArrowUp,ArrowDown,Copy,Trash2} from "lucide-react";
import type {MikkeContentBlock as MediaBlock,MikkeContentBlockType as MediaBlockType} from "@/lib/mikkeos/content/types";
import {createMikkeContentBlock as createMediaBlock} from "@/lib/mikkeos/content/blocks.js";
import {MikkeInsertMenu as MediaInsertMenu} from "./MikkeInsertMenu";
import {sliceMediaRichText} from "@/lib/mikkeos/content/rich-text";
export function MikkeContentEditor({blocks,onChange,renderBlock,onSaveSnippet,allowedTypes}:{allowedTypes?:MediaBlockType[];blocks:MediaBlock[];onChange:(blocks:MediaBlock[])=>void;renderBlock:(block:MediaBlock,onChange:(next:MediaBlock)=>void,onSplit:(start:number,end:number)=>void)=>ReactNode;onSaveSnippet?:(block:MediaBlock)=>void}) {
  const onChangeItems=(update:(items:MediaBlock[])=>MediaBlock[])=>onChange(update(blocks));
  const focusBlock = useRef<string | null>(null);
  useEffect(()=>{if(!focusBlock.current)return;const element=document.getElementById(`media-block-${focusBlock.current}`);(element?.querySelector<HTMLElement>('textarea,input,[contenteditable=true]') ?? element?.querySelector<HTMLElement>('button'))?.focus();focusBlock.current=null;},[blocks]);
  function insertBlock(index:number,type:MediaBlockType,level?:2|3) {const block=createMediaBlock(type);if(level)block.level=level;focusBlock.current=block.id;onChangeItems(items=>[...items.slice(0,index),block,...items.slice(index)]);}
  function splitParagraph(id:string,start:number,end:number) {const next=createMediaBlock("paragraph");focusBlock.current=next.id;onChangeItems(items=>{const index=items.findIndex(item=>item.id===id);if(index<0)return items;const current=items[index];next.text=(current.text??"").slice(end);next.align=current.align;next.richText=sliceMediaRichText(current,end,(current.text??"").length);return [...items.slice(0,index),{...current,text:(current.text??"").slice(0,start),richText:sliceMediaRichText(current,0,start)},next,...items.slice(index+1)];});}
  function move(index: number, direction: number) {
    onChangeItems((items) => { const target = index + direction; if (target < 0 || target >= items.length) return items; const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }

 return (<section aria-label="記事本文">{blocks.map((block, index) => <Fragment key={block.id}><MediaInsertMenu allowedTypes={allowedTypes} position={index} onInsert={(type,level)=>insertBlock(index,type,level)}/><article id={`media-block-${block.id}`} className="group relative rounded-xl border border-transparent px-2 py-1 focus-within:border-[var(--mikke-line)] sm:px-4">
          <details className="relative ml-auto w-fit text-[var(--mikke-muted)]"><summary aria-label="ブロックの操作" className="grid h-7 w-8 cursor-pointer list-none place-items-center rounded-lg text-lg hover:bg-[var(--mikke-primary-soft)]">⋯</summary><div className="absolute right-0 top-8 z-20 flex gap-1 rounded-lg border border-[var(--mikke-line)] bg-white p-1 shadow-lg"><button type="button" title="上へ" aria-label="上へ" disabled={index === 0} onClick={() => move(index, -1)} className="p-2 disabled:opacity-25"><ArrowUp size={14} /></button><button type="button" title="下へ" aria-label="下へ" disabled={index === blocks.length - 1} onClick={() => move(index, 1)} className="p-2 disabled:opacity-25"><ArrowDown size={14} /></button><button type="button" title="複製" aria-label="複製" onClick={() => onChangeItems((items) => [...items.slice(0,index+1), {...block,id:crypto.randomUUID()}, ...items.slice(index+1)])} className="p-2"><Copy size={14} /></button><button type="button" title="削除" aria-label="削除" onClick={() => onChangeItems((items) => items.filter((item) => item.id !== block.id))} className="p-2"><Trash2 size={14} /></button>{onSaveSnippet?<button type="button" onClick={()=>onSaveSnippet(block)} className="whitespace-nowrap p-2 text-xs">部品に保存</button>:null}</div></details>
          {renderBlock(block,next=>onChangeItems(items=>items.map(item=>item.id===block.id?next:item)),(start,end)=>splitParagraph(block.id,start,end))}
        </article></Fragment>)}<MediaInsertMenu allowedTypes={allowedTypes} position={blocks.length} onInsert={(type,level)=>insertBlock(blocks.length,type,level)}/></section>);
}
