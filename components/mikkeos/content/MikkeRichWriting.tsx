"use client";
import { useEffect, useRef, useState } from "react";
import type { MikkeContentBlock as MediaBlock } from "@/lib/mikkeos/content/types";

function safeLink(value:string){if(/[\s\\]/.test(value))return false;if(/^\/(?!\/)/.test(value))return true;try{return ["https:","http:"].includes(new URL(value).protocol);}catch{return false;}}

type Run = NonNullable<MediaBlock["richText"]>[number];
// Store text and supported marks only. Pasted HTML never becomes stored HTML.
function readRuns(root: HTMLElement): Run[] {
  const runs: Run[]=[];
  function walk(node: Node, marks: Omit<Run,"text">={}) {
    if(node.nodeType===Node.TEXT_NODE) { if(node.textContent) runs.push({...marks,text:node.textContent}); return; }
    if(!(node instanceof HTMLElement))return;
    if(node.tagName==="BR") {runs.push({text:"\n"});return;}
    const href=node.tagName==="A"?node.getAttribute("href"):undefined;
    const next={...marks,...(href&&safeLink(href)?{href}:{}),bold:marks.bold||["B","STRONG"].includes(node.tagName)||Number(node.style.fontWeight)>=600,strike:marks.strike||["S","STRIKE","DEL"].includes(node.tagName)};
    if(node!==root && ["DIV","P"].includes(node.tagName) && runs.length && !runs.at(-1)!.text.endsWith("\n"))runs.push({text:"\n"});
    node.childNodes.forEach(child=>walk(child,next));
  }
  root.childNodes.forEach(child=>walk(child));return runs;
}

export function MikkeRichWriting({block,onChange,onSplit,onUrlPaste}:{block:MediaBlock;onChange:(value:MediaBlock)=>void;onSplit?:(start:number,end:number)=>void;onUrlPaste?:(url:string)=>void}) {
  const ref=useRef<HTMLDivElement>(null);const committed=useRef(""); const [active,setActive]=useState(false);
  const selectionRange=useRef<Range|null>(null);const [linkOpen,setLinkOpen]=useState(false);const [linkUrl,setLinkUrl]=useState("");const [linkError,setLinkError]=useState("");
  const serialized=JSON.stringify(block.richText ?? [{text:block.text??""}]);
  useEffect(()=>{const root=ref.current;if(!root || document.activeElement===root && committed.current===serialized)return;root.replaceChildren();const runs:Run[]=JSON.parse(serialized);runs.forEach(run=>{const span=document.createElement(run.href&&safeLink(run.href)?"a":"span");if(span instanceof HTMLAnchorElement){span.setAttribute("href",run.href!);span.style.textDecoration="underline";span.style.color="var(--mikke-primary)";}span.textContent=run.text;if(run.bold)span.style.fontWeight="700";if(run.strike) {const strike=document.createElement("s");strike.append(span);root.append(strike);}else root.append(span);});},[serialized]);
  function commit(){if(ref.current){const richText=readRuns(ref.current);committed.current=JSON.stringify(richText);onChange({...block,text:richText.map(run=>run.text).join(""),richText});}}
  function format(command:string){ref.current?.focus();document.execCommand(command);commit();}
  function openLink(){const selection=window.getSelection();if(!selection?.rangeCount||!ref.current)return;const range=selection.getRangeAt(0);if(!ref.current.contains(range.commonAncestorContainer))return;let node=range.startContainer instanceof Element?range.startContainer:range.startContainer.parentElement;const anchor=node?.closest("a");if(range.collapsed&&anchor&&ref.current.contains(anchor))range.selectNodeContents(anchor);selectionRange.current=range.cloneRange();setLinkUrl(anchor?.getAttribute("href")??"");setLinkError(range.collapsed?"リンクを付ける文章を選択してください。":"");setLinkOpen(true);}
  function applyLink(remove=false){const range=selectionRange.current;if(!range||range.collapsed){setLinkError("リンクを付ける文章を選択してください。");return;}const url=linkUrl.trim();if(!remove&&!safeLink(url)){setLinkError("http:// または https:// で始まるURLを入力してください。");return;}ref.current?.focus();const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);document.execCommand(remove?"unlink":"createLink",false,remove?undefined:url);commit();setLinkOpen(false);setLinkError("");}
  return <div onFocus={()=>setActive(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setActive(false);}}>
    {active?<div role="toolbar" aria-label="文章の装飾" className="sticky top-36 z-20 flex flex-wrap items-center gap-1 rounded-lg border border-[var(--mikke-line)] bg-white p-1 shadow-sm">
      <select aria-label="文章の種類" value={block.type==="heading"?String(block.level??2):"paragraph"} onChange={e=>onChange({...block,type:e.target.value==="paragraph"?"paragraph":"heading",level:e.target.value==="3"?3:2})} className="p-2 text-sm"><option value="paragraph">文章</option><option value="2">大見出し</option><option value="3">小見出し</option></select>
      <button type="button" aria-label="太字" onMouseDown={e=>e.preventDefault()} onClick={()=>format("bold")} className="px-3 py-2 font-bold">B</button>
      <button type="button" aria-label="取り消し線" onMouseDown={e=>e.preventDefault()} onClick={()=>format("strikeThrough")} className="px-3 py-2 line-through">S</button>
      <button type="button" onMouseDown={e=>e.preventDefault()} onClick={openLink} className="px-2 py-1 text-sm">リンク</button>
      <select aria-label="文章の配置" value={block.align??"left"} onChange={e=>onChange({...block,align:e.target.value as MediaBlock["align"]})} className="p-2 text-sm"><option value="left">左寄せ</option><option value="center">中央寄せ</option><option value="right">右寄せ</option></select>
      {linkOpen?<div className="flex w-full flex-wrap items-center gap-2 border-t border-[var(--mikke-line)] pt-2"><input autoFocus aria-label="選択した文章のリンク先URL" placeholder="https://" value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();applyLink();}if(e.key==="Escape"){setLinkOpen(false);ref.current?.focus();}}} className="min-w-0 flex-1 rounded border border-[var(--mikke-line)] p-2 text-sm"/><button type="button" onClick={()=>applyLink()} className="text-sm">適用</button><button type="button" onClick={()=>applyLink(true)} className="text-sm">解除</button><button type="button" onClick={()=>setLinkOpen(false)} className="text-sm">閉じる</button>{linkError?<p role="alert" className="w-full text-xs">{linkError}</p>:null}</div>:null}
    </div>:null}
    <div ref={ref} role="textbox" aria-label={block.type==="heading"?"見出し":"本文の文章"} aria-multiline="true" contentEditable suppressContentEditableWarning onClick={event=>{if((event.target as Element).closest("a"))event.preventDefault();}} onInput={commit}
      onPaste={event=>{event.preventDefault();const text=event.clipboardData.getData("text/plain");if(!block.text?.trim()&&onUrlPaste&&/^https:\/\/\S+$/.test(text.trim())){onUrlPaste(text.trim());return;}document.execCommand("insertText",false,text);commit();}}
      onKeyDown={event=>{if(event.key!=="Enter"||event.nativeEvent.isComposing||event.keyCode===229)return;if(event.shiftKey){event.preventDefault();document.execCommand("insertLineBreak");commit();return;}if(!onSplit)return;const selection=window.getSelection();if(!selection?.rangeCount||!ref.current)return;event.preventDefault();const range=selection.getRangeAt(0);const prefix=range.cloneRange();prefix.selectNodeContents(ref.current);prefix.setEnd(range.startContainer,range.startOffset);onSplit(prefix.toString().length,prefix.toString().length+range.toString().length);}}
      style={{textAlign:block.align??"left",fontSize:block.type==="heading"?(block.level===3?"1.25rem":"1.5rem"):"1.0625rem",fontWeight:block.type==="heading"?700:400}}
      className="min-h-14 whitespace-pre-wrap break-words py-3 leading-8 outline-none empty:before:text-[var(--mikke-muted)] empty:before:content-['本文を書いてみましょう']"/>
  </div>;
}
