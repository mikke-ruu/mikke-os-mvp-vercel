"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Heading2, ImageIcon, Link2, List, Minus, Plus, Quote, Type, X } from "lucide-react";
import type { MikkeContentBlockType as MediaBlockType } from "@/lib/mikkeos/content/types";

const options: {type:MediaBlockType;label:string;icon:typeof Type;level?:2|3}[] = [
  {type:"paragraph",label:"文章",icon:Type}, {type:"image",label:"画像",icon:ImageIcon},
  {type:"link",label:"リンクカード",icon:Link2}, {type:"heading",label:"大見出し",icon:Heading2,level:2},
  {type:"heading",label:"小見出し",icon:Heading2,level:3}, {type:"list",label:"箇条書き",icon:List},
  {type:"video",label:"動画",icon:Link2}, {type:"links",label:"リンク集",icon:List},
  {type:"image-text",label:"画像＋文章",icon:ImageIcon}, {type:"gallery",label:"画像グリッド",icon:ImageIcon}, {type:"cta",label:"CTA（案内ボタン）",icon:Link2},
  {type:"quote",label:"引用",icon:Quote}, {type:"divider",label:"区切り線",icon:Minus}
];

export function MikkeInsertMenu({ position, onInsert, allowedTypes }: {position:number;allowedTypes?:MediaBlockType[];onInsert:(type:MediaBlockType,level?:2|3)=>void}) {
  const [open,setOpen]=useState(false);const [placement,setPlacement]=useState({left:false,top:0});const root=useRef<HTMLDivElement>(null);const button=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!open)return;function close(event:PointerEvent){if(!root.current?.contains(event.target as Node))setOpen(false);}document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close);},[open]);
  useLayoutEffect(()=>{if(!open)return;function place(){const rect=button.current?.getBoundingClientRect();if(!rect)return;setPlacement({left:rect.left>=176,top:Math.min(0,Math.max(8,window.innerHeight-(root.current?.querySelector<HTMLElement>('[role="group"]')?.offsetHeight??370)-8)-rect.top)});}place();window.addEventListener("resize",place);window.addEventListener("scroll",place,true);return()=>{window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);};},[open]);
  return <div ref={root} className="relative my-1 flex min-h-9 flex-wrap items-center" onKeyDown={event=>{if(event.key==="Escape"){setOpen(false);button.current?.focus();}}}>
    <button ref={button} type="button" aria-label={`${position+1}番目に挿入`} aria-expanded={open} aria-controls={`media-insert-${position}`} onClick={()=>setOpen(value=>!value)} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--mikke-line)] bg-white text-[var(--mikke-muted)] hover:border-[var(--mikke-primary)] hover:text-[var(--mikke-primary)] focus-visible:outline-2 focus-visible:outline-[var(--mikke-primary)]">{open?<X size={17}/>:<Plus size={17}/>}</button>
    {open ? <div id={`media-insert-${position}`} role="group" aria-label="挿入する内容" style={placement.left?{right:"calc(100% + 8px)",top:placement.top}:undefined} className={(placement.left?"absolute w-40 grid-cols-1 ":"relative mt-2 w-full grid-cols-2 ")+"z-30 grid gap-0 rounded-lg border border-[var(--mikke-line)] bg-white p-1 shadow-lg"}>{options.filter(option=>!allowedTypes||allowedTypes.includes(option.type)).map(({type,label,icon:Icon,level})=><button key={label} type="button" style={{fontSize:12,lineHeight:"18px",minHeight:0,padding:"3px 8px"}} onClick={()=>{onInsert(type,level);setOpen(false);}} className="flex items-center min-h-0 gap-2 rounded px-2 py-1 text-left text-[12px] leading-[18px] hover:bg-[var(--mikke-primary-soft)] focus:bg-[var(--mikke-primary-soft)]"><Icon size={14} className="shrink-0"/>{label}</button>)}</div>:null}
  </div>;
}

