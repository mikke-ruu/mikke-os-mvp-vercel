'use client';
import {useId,useLayoutEffect,useRef,useState} from 'react';
import styles from './inline-policy-preview.module.css';
type Policy={id:string;title:string;body?:string};
/** One bounded reader. Opening policies never changes consent or form answers. */
export function InlinePolicyPreview({policies}:{policies:Policy[]}){
 const panelId=useId();
 const [active,setActive]=useState<string|null>(null),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement|null>(null),position=useRef<{element:HTMLElement;top:number}|null>(null);
 const remember=()=>{let el=root.current?.parentElement;while(el){if(/auto|scroll/.test(getComputedStyle(el).overflowY)&&el.scrollHeight>el.clientHeight){position.current={element:el,top:el.scrollTop};return;}el=el.parentElement;}position.current={element:document.scrollingElement as HTMLElement,top:document.scrollingElement?.scrollTop??0};};
 useLayoutEffect(()=>{if(position.current)position.current.element.scrollTop=position.current.top;},[active]);
 const selected=policies.find(p=>p.id===active);
 const close=()=>{remember();setActive(null);trigger.current?.focus({preventScroll:true});};
 return <div ref={root} className={styles.reader}><div className={styles.tabs} aria-label="規約の確認">{policies.map(p=><button key={p.id} type="button" aria-expanded={active===p.id} aria-controls={panelId} onClick={e=>{remember();trigger.current=e.currentTarget;setActive(active===p.id?null:p.id);}}>{p.title}</button>)}</div>{selected&&<section id={panelId} className={styles.panel} aria-label={selected.title}><header><h3>{selected.title}</h3><button type="button" onClick={close}>閉じる</button></header><div className={styles.body} tabIndex={0}>{selected.body||'保存内容を確認できませんでした。本部設定で確認してください。'}</div></section>}</div>;
}
