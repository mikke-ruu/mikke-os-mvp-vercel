'use client';
import {useEffect,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {BookOpen, ClipboardList, Home, MoreHorizontal, Menu, X, type LucideIcon} from 'lucide-react';
import styles from './headquarters-shell.module.css';
type NavItem={href:string;label:string;icon:LucideIcon};
export function HeadquartersShell({name,role,mikkeId,nav,activeHref,createLinks,onSignOut,children}:{name:string;role:string;mikkeId?:string|null;nav:NavItem[];activeHref:string;createLinks:{href:string;label:string}[];onSignOut:()=>void;children:ReactNode}){
 const [menu,setMenu]=useState(false),[create,setCreate]=useState(false);
 useEffect(()=>{setMenu(false);setCreate(false);},[activeHref]);
 useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setMenu(false);setCreate(false);}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[]);
 const roles:Record<string,string>={owner:'本部責任者',administrator:'本部運営者',learning_operator:'受講管理担当',course_editor:'講座編集担当'};
 const course=nav.find(item=>item.label==='講座');const applications=nav.find(item=>item.label==='申込');
 const navLink=(item:NavItem)=> <Link key={item.href} href={item.href} aria-current={activeHref===item.href?'page':undefined} className={activeHref===item.href?styles.on:undefined} onClick={()=>setMenu(false)}>{item.label}</Link>;
 return <div className={styles.app}>
  {menu?<button className={styles.backdrop} aria-label="メニューを閉じる" onClick={()=>setMenu(false)}/>:null}
  <aside id="academy-hq-navigation" className={`${styles.side} ${menu?styles.open:''}`}><div className={styles.brand}>mikkeOS<small>Academy</small></div><button type="button" className={styles.close} aria-label="メニューを閉じる" onClick={()=>setMenu(false)}><X size={20}/></button><nav aria-label="本部メニュー" className={styles.nav}>{nav.map(navLink)}</nav><div className={styles.sideAccount}><Link href="/academy/select">本部・本人ページを切り替える</Link><button type="button" onClick={onSignOut}>ログアウト</button></div></aside>
  <div className={styles.workspace}><header className={styles.top}><button type="button" className={styles.hamburger} aria-label="本部メニューを開く" aria-expanded={menu} aria-controls="academy-hq-navigation" onClick={()=>setMenu(value=>!value)}><Menu size={21}/></button><strong title={name}>{name}</strong><details className={styles.account}><summary>{roles[role]??role} <span aria-hidden>▾</span></summary><div>{mikkeId?<p>mikke ID: {mikkeId}</p>:null}<Link href="/academy/select">本部・本人ページを切り替える</Link><button type="button" onClick={onSignOut}>ログアウト</button></div></details></header><div className={styles.content}>{children}</div></div>
  <nav className={styles.bottom} aria-label="よく使う本部メニュー"><Link href={nav[0].href} aria-current={activeHref===nav[0].href?'page':undefined}><Home/><small>ホーム</small></Link>{course?<Link href={course.href} aria-current={activeHref===course.href?'page':undefined}><BookOpen/><small>講座</small></Link>:<span/>}<div className={styles.createSlot}><button type="button" className={styles.createButton} aria-label="作成" disabled={!createLinks.length} aria-expanded={create} aria-controls="academy-hq-create" onClick={()=>{setCreate(value=>!value);setMenu(false);}}/></div>{applications?<Link href={applications.href} aria-current={activeHref===applications.href?'page':undefined}><ClipboardList/><small>申込</small></Link>:<span/>}<button type="button" aria-label="その他のメニュー" aria-expanded={menu} onClick={()=>{setMenu(value=>!value);setCreate(false);}}><MoreHorizontal/><small>その他</small></button></nav>
  {create?<nav id="academy-hq-create" aria-label="作成するもの" className={styles.createMenu}>{createLinks.map(item=><Link key={item.href} href={item.href} onClick={()=>setCreate(false)}>{item.label}</Link>)}</nav>:null}
 </div>;
}
