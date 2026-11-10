'use client';
import styles from './common-creation.module.css';
export type CreationTab='course'|'plan'|'review'|'event';
export function CreationFlowHeader({tab,onSelect,disabled=()=>false}:{tab:CreationTab;onSelect:(tab:CreationTab)=>void;disabled?:(tab:CreationTab)=>boolean}){
 return <div className={styles.flowNavigation}><header className={styles.head}><span>CREATE</span><h1>講座をつくって募集する</h1></header><nav role="tablist" aria-label="作成する内容" className={styles.tabs}>{(['course','plan','review','event'] as const).map((value,index)=><button type="button" key={value} role="tab" aria-selected={tab===value} disabled={disabled(value)} onClick={()=>onSelect(value)}>{index+1} {['講座','販売プラン','販売ページの確認・公開','開催・受付'][index]}</button>)}</nav></div>;
}
