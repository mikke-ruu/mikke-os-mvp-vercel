'use client';

import {useEffect,useRef,type ReactNode} from 'react';
import styles from './headquarters-settings.module.css';

export function SettingsDialog({title,onClose,children,wide=false,closeDisabled=false,inline=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean;closeDisabled?:boolean;inline?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{const target=dialog.current;if(inline){const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;heading.current?.focus();return()=>previous?.focus();}if(!target)return;const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;target.showModal();heading.current?.focus();return()=>{target.close();previous?.focus();};},[]);
 const header=<header className={styles.dialogHeader}><h2 ref={heading} tabIndex={-1}>{title}</h2><button className={styles.btn} type="button" disabled={closeDisabled} onClick={onClose} aria-label={title+'を閉じる'}>閉じる</button></header>;
 if(inline)return <section className={styles.inlineDialog} aria-label={title}>{header}{children}</section>;
 return <dialog ref={dialog} className={`${styles.settingsDialog} ${wide?styles.wideDialog:''}`} aria-label={title} onCancel={event=>{event.preventDefault();if(!closeDisabled)onClose();}}>
  <header className={styles.dialogHeader}><h2 ref={heading} tabIndex={-1}>{title}</h2><button className={styles.btn} type="button" disabled={closeDisabled} onClick={onClose} aria-label={`${title}を閉じる`}>閉じる</button></header>
  {children}
 </dialog>;
}
